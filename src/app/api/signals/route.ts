// app/api/signals/route.ts
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

/**
 * Retorna apenas as colunas com sinal forte (>= 65% ou <= 35%).
 * Aceita ?threshold=70 para apertar/afrouxar.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const threshold = Math.max(50, Math.min(85, parseInt(url.searchParams.get('threshold') || '65', 10)));

    const baseUrl = getBaseUrl(req);
    const virtualData = await fetchVirtualData(baseUrl);
    const games = parseGames(virtualData);

    if (games.length === 0) {
      return NextResponse.json({ ok: true, signals: [], note: 'Sem dados parseados.' });
    }

    const grid = buildGrid(games);
    const hours = sortedHoursDesc(grid);
    if (hours.length < 2) {
      return NextResponse.json({ ok: true, signals: [], note: 'Histórico insuficiente.' });
    }

    const currentHour = hours[0];
    const currentGoals = grid.get(currentHour)!;
    const previousGoals = grid.get(hours[1])!;

    const flat: number[] = [];
    for (let i = 1; i < hours.length; i++) flat.push(...grid.get(hours[i])!);
    const globalMean = mean(flat);
    const globalStd = stdDev(flat);

    const histories: number[][] = [];
    for (let c = 0; c < 20; c++) {
      const hist: number[] = [];
      for (let i = 1; i < Math.min(hours.length, 6); i++) hist.push(grid.get(hours[i])![c]);
      histories.push(hist);
    }

    const lowerBound = 100 - threshold;
    const signals = [];

    for (let col = 1; col <= 20; col++) {
      // Pula colunas que já foram jogadas (gols ≠ 0 e a hora atual não acaba de começar)
      // Mantenha tudo se preferir mostrar histórico — comente o if abaixo.
      // if (currentGoals[col - 1] !== 0) continue;

      const v = verticalSignal(histories[col - 1]);
      const h = heatSignal(currentGoals, previousGoals, col);
      const l = lateralSignal(currentGoals, histories, col);
      const z = zSignal(histories[col - 1], globalMean, globalStd);
      const r = probabilityOver({ vertical: v, heat: h, lateral: l, z });

      if (r.pOver >= threshold) {
        signals.push({
          column: col,
          game: `J${col}`,
          time: `${pad2(currentHour)}:${pad2(columnToMinute(col))}`,
          direction: 'OVER',
          pOver: r.pOver,
          oddsTarget: +(100 / r.pOver).toFixed(2),
          band: r.band,
          action: r.action,
          confidence: confidenceLabel(r.pOver, true),
          components: r.components,
        });
      } else if (r.pOver <= lowerBound) {
        signals.push({
          column: col,
          game: `J${col}`,
          time: `${pad2(currentHour)}:${pad2(columnToMinute(col))}`,
          direction: 'UNDER',
          pUnder: r.pUnder,
          oddsTarget: +(100 / r.pUnder).toFixed(2),
          band: r.band,
          action: r.action,
          confidence: confidenceLabel(r.pOver, false),
          components: r.components,
        });
      }
    }

    // Ordena por convicção (mais distante do 50% primeiro)
    signals.sort((a, b) => Math.abs((b.pOver ?? 50) - 50) - Math.abs((a.pOver ?? 50) - 50));

    return NextResponse.json({
      ok: true,
      hour: currentHour,
      generatedAt: new Date().toISOString(),
      threshold,
      count: signals.length,
      signals,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Falha em signals', detail: String(err?.message || err) },
      { status: 500 },
    );
  }
}

function confidenceLabel(pOver: number, isOver: boolean): string {
  const p = isOver ? pOver : 100 - pOver;
  if (p >= 75) return 'muito alta';
  if (p >= 65) return 'alta';
  if (p >= 55) return 'média';
  return 'baixa';
}
