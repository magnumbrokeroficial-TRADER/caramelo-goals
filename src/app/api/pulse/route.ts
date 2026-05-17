// app/api/pulse/route.ts
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
import { mean, stdDev } from '@/lib/strategy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Retorna intensidade (heat) por coluna para alimentar gauges/mapas de calor.
 * Cada coluna recebe um valor [-1, +1] onde:
 *   +1 = muito acima da média (Over forte)
 *    0 = neutro
 *   -1 = muito abaixo (Under forte)
 */
export async function GET(req: NextRequest) {
  try {
    const baseUrl = getBaseUrl(req);
    const virtualData = await fetchVirtualData(baseUrl);
    const games = parseGames(virtualData);

    if (games.length === 0) {
      return NextResponse.json({ ok: false, error: 'Sem dados parseados.' }, { status: 200 });
    }

    const grid = buildGrid(games);
    const hours = sortedHoursDesc(grid);
    if (hours.length < 2) {
      return NextResponse.json({ ok: false, error: 'Histórico insuficiente.' });
    }

    const currentHour = hours[0];
    const currentGoals = grid.get(currentHour)!;

    // Histórico achatado para baseline
    const flat: number[] = [];
    for (let i = 1; i < hours.length; i++) flat.push(...grid.get(hours[i])!);
    const baseMean = mean(flat);
    const baseStd = stdDev(flat) || 1;

    // Heat por coluna comparando atual com histórico daquela coluna
    const columns = [];
    let hottest = { column: 0, heat: -Infinity };
    let coldest = { column: 0, heat: Infinity };

    for (let col = 1; col <= 20; col++) {
      const cur = currentGoals[col - 1];
      const histVals: number[] = [];
      for (let i = 1; i < Math.min(hours.length, 6); i++) histVals.push(grid.get(hours[i])![col - 1]);
      const histAvg = mean(histVals);

      // Z-score local da coluna
      const localZ = (cur - histAvg) / baseStd;
      const intensity = Math.tanh(localZ);

      // Intensidade vs global também
      const globalZ = (cur - baseMean) / baseStd;
      const globalIntensity = Math.tanh(globalZ);

      // Combinação 70% local, 30% global
      const heat = +(0.7 * intensity + 0.3 * globalIntensity).toFixed(3);

      if (heat > hottest.heat) hottest = { column: col, heat };
      if (heat < coldest.heat) coldest = { column: col, heat };

      columns.push({
        column: col,
        game: `J${col}`,
        time: `${pad2(currentHour)}:${pad2(columnToMinute(col))}`,
        goals: cur,
        histAvg: +histAvg.toFixed(2),
        heat,
        // Cor sugerida pro front
        color: heatToColor(heat),
        intensity: Math.abs(heat),
        direction: heat > 0.15 ? 'over' : heat < -0.15 ? 'under' : 'neutral',
      });
    }

    // Heat global da hora
    const hourSum = currentGoals.reduce((a, b) => a + b, 0);
    const previousSum = grid.get(hours[1])!.reduce((a, b) => a + b, 0);
    const hourHeat = +Math.tanh((hourSum - previousSum) / Math.max(1, previousSum)).toFixed(3);

    return NextResponse.json({
      ok: true,
      hour: currentHour,
      generatedAt: new Date().toISOString(),
      hourHeat,                // -1..+1, calor geral da hora corrente
      hourGoals: hourSum,
      previousHourGoals: previousSum,
      hottest,
      coldest,
      baseline: { mean: +baseMean.toFixed(3), std: +baseStd.toFixed(3) },
      columns,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Falha no pulse', detail: String(err?.message || err) },
      { status: 500 },
    );
  }
}

function heatToColor(heat: number): string {
  // -1 → azul frio, 0 → cinza, +1 → vermelho quente
  const h = Math.max(-1, Math.min(1, heat));
  if (h >= 0) {
    // verde→amarelo→vermelho
    const r = Math.round(255 * h);
    const g = Math.round(180 * (1 - h * 0.5));
    return `rgb(${r},${g},80)`;
  } else {
    const b = Math.round(255 * -h);
    const g = Math.round(150 * (1 + h * 0.5));
    return `rgb(80,${g},${b})`;
  }
}
