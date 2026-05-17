// app/api/odds/route.ts
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
    const baseUrl = getBaseUrl(req);
    const virtualData = await fetchVirtualData(baseUrl);
    const games = parseGames(virtualData);

    if (games.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum jogo parseado do /api/virtual. Ajuste parseGames em lib/virtual.ts.' },
        { status: 200 },
      );
    }

    const grid = buildGrid(games);
    const hours = sortedHoursDesc(grid);

    if (hours.length < 2) {
      return NextResponse.json(
        { ok: false, error: 'Histórico insuficiente (mínimo 2 horas).', hoursAvailable: hours.length },
        { status: 200 },
      );
    }

    const currentHour = hours[0];
    const previousHour = hours[1];
    const currentGoals = grid.get(currentHour)!;
    const previousGoals = grid.get(previousHour)!;

    // Estatísticas globais (todas as horas históricas, excluindo a atual)
    const historicalFlat: number[] = [];
    for (let i = 1; i < hours.length; i++) {
      historicalFlat.push(...grid.get(hours[i])!);
    }
    const globalMean = mean(historicalFlat);
    const globalStd = stdDev(historicalFlat);

    // Históricos por coluna (até 5 horas anteriores)
    const histories: number[][] = [];
    for (let c = 0; c < 20; c++) {
      const colHist: number[] = [];
      for (let i = 1; i < Math.min(hours.length, 6); i++) {
        colHist.push(grid.get(hours[i])![c]);
      }
      histories.push(colHist);
    }

    const odds = [];
    for (let col = 1; col <= 20; col++) {
      const v = verticalSignal(histories[col - 1]);
      const h = heatSignal(currentGoals, previousGoals, col);
      const l = lateralSignal(currentGoals, histories, col);
      const z = zSignal(histories[col - 1], globalMean, globalStd);

      const r = probabilityOver({ vertical: v, heat: h, lateral: l, z });

      const oddsOver = +(100 / r.pOver).toFixed(2);
      const oddsUnder = +(100 / r.pUnder).toFixed(2);

      const minute = columnToMinute(col);
      odds.push({
        column: col,
        game: `J${col}`,
        time: `${pad2(currentHour)}:${pad2(minute)}`,
        played: currentGoals[col - 1] !== 0 || col * 3 - 2 < new Date().getMinutes(),
        goalsThisHour: currentGoals[col - 1],
        pOver: r.pOver,
        pUnder: r.pUnder,
        oddsOver,
        oddsUnder,
        band: r.band,
        action: r.action,
      });
    }

    return NextResponse.json({
      ok: true,
      hour: currentHour,
      generatedAt: new Date().toISOString(),
      meta: {
        historicalHours: hours.length - 1,
        globalMean: +globalMean.toFixed(3),
        globalStd: +globalStd.toFixed(3),
      },
      odds,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Falha ao calcular odds', detail: String(err?.message || err) },
      { status: 500 },
    );
  }
}
