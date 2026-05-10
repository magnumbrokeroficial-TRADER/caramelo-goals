/* ============================================================
   📐 TRENDLINES + S/R ZONES
   ============================================================
   Implementa lógica clássica de análise técnica adaptada pra
   série de gols. Inspirado na ideia geral de indicadores como
   o DonForex PerfectZones (que é proprietário e não foi
   decompilado), mas todo o código aqui é original e baseado
   em algoritmos públicos:

   1. SWING DETECTION (Williams Fractals)
      - Pivô de alta: ponto cujos N vizinhos de cada lado são menores
      - Pivô de baixa: ponto cujos N vizinhos de cada lado são maiores

   2. TRENDLINE (regressão entre dois swings da mesma natureza)
      - Resistência: liga 2+ topos descendentes ou ascendentes
      - Suporte: liga 2+ fundos descendentes ou ascendentes
      - Macro: usa N grande (sinaliza tendência longa)
      - Micro: usa N pequeno (sinaliza tendência curta)

   3. S/R ZONES (clustering de pivôs por proximidade)
      - Agrupa pivôs em "bandas" horizontais quando estão
        próximos em valor
      - Força da zona = quantos pivôs caíram nela (W = wins/touches)
      - Range da zona = amplitude vertical (R = range em pontos)
============================================================ */

/* ----- 1. SWING DETECTION ----- */

function findSwings(values, leftBars = 5, rightBars = 5) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = leftBars; i < values.length - rightBars; i++) {
    const v = values[i];
    let isHigh = true, isLow = true;

    for (let k = 1; k <= leftBars; k++) {
      if (values[i - k] >= v) isHigh = false;
      if (values[i - k] <= v) isLow = false;
    }
    for (let k = 1; k <= rightBars; k++) {
      if (values[i + k] >= v) isHigh = false;
      if (values[i + k] <= v) isLow = false;
    }

    if (isHigh) swingHighs.push({ index: i, value: v });
    if (isLow) swingLows.push({ index: i, value: v });
  }

  return { swingHighs, swingLows };
}

/* ----- 2. TRENDLINES ----- */

/**
 * Calcula trendlines a partir dos pivôs.
 * - Resistência (topos): liga os 2 topos mais recentes
 * - Suporte (fundos): liga os 2 fundos mais recentes
 *
 * Retorna pares { p1, p2, slope, type } onde p1/p2 são os pontos da reta
 * e podemos extrapolar pra qualquer índice futuro.
 */
function buildTrendlines(swings, dataLen, label = 'macro') {
  const lines = [];

  // RESISTÊNCIA — pega os 2 últimos topos
  if (swings.swingHighs.length >= 2) {
    const last = swings.swingHighs[swings.swingHighs.length - 1];
    const prev = swings.swingHighs[swings.swingHighs.length - 2];
    const slope = (last.value - prev.value) / (last.index - prev.index);
    lines.push({
      type: 'resistance',
      label,
      p1: prev,
      p2: last,
      slope,
      // extrapola até o final da série
      extendTo: dataLen - 1,
      extrapolatedValue: last.value + slope * (dataLen - 1 - last.index),
    });
  }

  // SUPORTE — pega os 2 últimos fundos
  if (swings.swingLows.length >= 2) {
    const last = swings.swingLows[swings.swingLows.length - 1];
    const prev = swings.swingLows[swings.swingLows.length - 2];
    const slope = (last.value - prev.value) / (last.index - prev.index);
    lines.push({
      type: 'support',
      label,
      p1: prev,
      p2: last,
      slope,
      extendTo: dataLen - 1,
      extrapolatedValue: last.value + slope * (dataLen - 1 - last.index),
    });
  }

  return lines;
}

/* ----- 3. S/R ZONES ----- */

/**
 * Agrupa pivôs em zonas horizontais.
 * - tolerance: amplitude vertical (em unidades de gols) pra considerar
 *   dois pivôs "no mesmo nível"
 * - minTouches: quantos pivôs precisam cair na zona pra ela existir
 *
 * Retorna lista de zonas com:
 *   { center, low, high, touches, range, strength }
 * Strength = touches normalizado de 0 a 100.
 */
function buildSRZones(values, swings, tolerance = 2.5, minTouches = 3) {
  // Combina topos e fundos como "pivôs" comuns — todos são níveis
  // que o "preço" testou e respeitou
  const allPivots = [
    ...swings.swingHighs.map(p => ({ ...p, kind: 'high' })),
    ...swings.swingLows.map(p => ({ ...p, kind: 'low' })),
  ].sort((a, b) => a.value - b.value);

  if (allPivots.length === 0) return [];

  // Clustering simples: percorre pivôs ordenados por valor;
  // funde no cluster atual se a distância <= tolerance
  const clusters = [];
  let current = [allPivots[0]];

  for (let i = 1; i < allPivots.length; i++) {
    const p = allPivots[i];
    const lastInCurrent = current[current.length - 1];
    if (p.value - lastInCurrent.value <= tolerance) {
      current.push(p);
    } else {
      if (current.length >= minTouches) clusters.push(current);
      current = [p];
    }
  }
  if (current.length >= minTouches) clusters.push(current);

  // Converte clusters em zonas
  const maxTouches = Math.max(...clusters.map(c => c.length), 1);
  return clusters.map((cluster, idx) => {
    const vals = cluster.map(p => p.value);
    const low = Math.min(...vals);
    const high = Math.max(...vals);
    const center = vals.reduce((s, v) => s + v, 0) / vals.length;
    return {
      id: idx + 1,
      center,
      low,
      high,
      touches: cluster.length,
      range: high - low,
      strength: Math.round((cluster.length / maxTouches) * 100),
      lastTouchIndex: Math.max(...cluster.map(p => p.index)),
    };
  }).sort((a, b) => b.strength - a.strength);
}

/* ----- 4. ENTRY POINT ----- */

/**
 * Calcula tudo de uma vez pra dois níveis (macro + micro).
 *
 * cfg = {
 *   macroSwingBars: 12,   // pivôs precisam de 12 bars de cada lado (longo prazo)
 *   microSwingBars: 4,    // pivôs precisam de 4 bars de cada lado (curto prazo)
 *   srTolerance: 2.5,     // amplitude vertical pra agrupar pivôs em zona
 *   srMinTouches: 3,      // mínimo de toques pra zona existir
 * }
 */
function computeTrendlinesAndZones(values, cfg = {}) {
  const c = {
    macroSwingBars: 12,
    microSwingBars: 4,
    srTolerance: 2.5,
    srMinTouches: 3,
    ...cfg,
  };

  const macroSwings = findSwings(values, c.macroSwingBars, c.macroSwingBars);
  const microSwings = findSwings(values, c.microSwingBars, c.microSwingBars);

  const macroLines = buildTrendlines(macroSwings, values.length, 'macro');
  const microLines = buildTrendlines(microSwings, values.length, 'micro');

  // S/R usa pivôs MACRO (mais confiáveis pra zonas)
  const zones = buildSRZones(values, macroSwings, c.srTolerance, c.srMinTouches);

  return {
    macroLines,
    microLines,
    zones,
    macroSwings,
    microSwings,
  };
}
