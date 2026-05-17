// app/api/analyst/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchVirtualData,
  parseGames,
  buildGrid,
  sortedHoursDesc,
  getBaseUrl,
  pad2,
  columnToMinute,
} from '@/lib/virtual';
import {
  verticalSignal,
  heatSignal,
  lateralSignal,
  zSignal,
  probabilityOver,
  mean,
  stdDev,
} from '@/lib/strategy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const colParam = url.searchParams.get('col');
    const onlyCol = colParam ? parseInt(colParam, 10) : null;

    const baseUrl = getBaseUrl(req);
    const virtualData = await fetchVirtualData(baseUrl);
    const games = parseGames(virtualData);

    if (games.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum jogo parseado. Ajuste parseGames em lib/virtual.ts.' },
        { status: 200 },
      );
    }

    const grid = buildGrid(games);
    const hours = sortedHoursDesc(grid);
    if (hours.length < 2) {
      return NextResponse.json({ ok: false, error: 'Histórico insuficiente.', hoursAvailable: hours.length });
    }

    const currentHour = hours[0];
    const currentGoals = grid.get(currentHour)!;
    const previousGoals = grid.get(hours[1])!;

    const historicalFlat: number[] = [];
    for (let i = 1; i < hours.length; i++) historicalFlat.push(...grid.get(hours[i])!);
    const globalMean = mean(historicalFlat);
    const globalStd = stdDev(historicalFlat);

    const histories: number[][] = [];
    for (let c = 0; c < 20; c++) {
      const colHist: number[] = [];
      for (let i = 1; i < Math.min(hours.length, 6); i++) colHist.push(grid.get(hours[i])![c]);
      histories.push(colHist);
    }

    const columnsRange = onlyCol && onlyCol >= 1 && onlyCol <= 20 ? [onlyCol] : [...Array(20)].map((_, i) => i + 1);

    const analysis = columnsRange.map(col => {
      const v = verticalSignal(histories[col - 1]);
      const h = heatSignal(currentGoals, previousGoals, col);
      const l = lateralSignal(currentGoals, histories, col);
      const z = zSignal(histories[col - 1], globalMean, globalStd);
      const r = probabilityOver({ vertical: v, heat: h, lateral: l, z });

      // Quebra dos pesos pro front mostrar
      const contributions = {
        vertical: +(0.4 * Math.tanh(v / 1.5)).toFixed(3),
        heat: +(0.25 * Math.tanh(h / 0.5)).toFixed(3),
        lateral: +(0.2 * Math.tanh(l / 2.0)).toFixed(3),
        z: +(0.15 * Math.tanh(z / 1.0)).toFixed(3),
      };

      const minute = columnToMinute(col);
      return {
        column: col,
        game: `J${col}`,
        time: `${pad2(currentHour)}:${pad2(minute)}`,
        goalsThisHour: currentGoals[col - 1],
        history: histories[col - 1], // [H-1, H-2, H-3, H-4, H-5]
        components: r.components,
        contributions,
        score: r.score,
        pOver: r.pOver,
        pUnder: r.pUnder,
        band: r.band,
        action: r.action,
      };
    });

    // Recomendação operacional global
    const strong = analysis.filter(a => a.pOver >= 65 || a.pOver <= 35);
    const summary = {
      strongSignals: strong.length,
      bestOver: analysis.reduce((max, a) => (a.pOver > max.pOver ? a : max), analysis[0]),
      bestUnder: analysis.reduce((min, a) => (a.pOver < min.pOver ? a : min), analysis[0]),
    };

    return NextResponse.json({
      ok: true,
      hour: currentHour,
      generatedAt: new Date().toISOString(),
      meta: {
        historicalHours: hours.length - 1,
        globalMean: +globalMean.toFixed(3),
        globalStd: +globalStd.toFixed(3),
        weights: { vertical: 0.4, heat: 0.25, lateral: 0.2, z: 0.15 },
      },
      summary,
      analysis,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Falha na análise', detail: String(err?.message || err) },
      { status: 500 },
    );
  }
}
