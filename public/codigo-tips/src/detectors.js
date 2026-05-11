/* ============================================================
   🎯 DETECTORES DE PADRÃO
   ============================================================
   12 detectores especializados. Cada um caça um padrão
   específico na série de gols. Retornam:
     null              → padrão não detectado
     { ... signal }    → padrão detectado com:
       - active        → boolean (sempre true se retornou)
       - confidence    → 0-100
       - pattern       → nome do padrão
       - direction     → 'over' ou 'under'
       - message       → texto explicativo em PT-BR
       - market        → array de mercados sugeridos
       - checks        → checagens individuais que passaram

   Padrões implementados:
   1. Mean Reversion        (banda inf + RSI baixo + virada)
   2. Trend Continuation    (acima da MM + momento + RSI saudável)
   3. Top Reversal          (banda sup + RSI alto + freada)
   4. Squeeze Breakout      (compressão + expansão)
   5. Bearish Divergence    (preço sobe, momento cai)
   6. Bullish Divergence    (preço cai, momento sobe)
   7. Three White Soldiers  (3 rodadas em alta — NOVO)
   8. Three Black Crows     (3 rodadas em queda — NOVO)
   9. Hammer                (queda forte + recuperação — NOVO)
   10. Shooting Star        (subida forte + queda — NOVO)
   11. Cluster de Topo      (consolidação no topo — NOVO)
   12. Cluster de Fundo     (consolidação no fundo — NOVO)
============================================================ */

// ====== 1. MEAN REVERSION ======
function detectMeanReversion(state, i) {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null;

  const v = values[i];
  const lower = bands.lower[i];
  const r = rsi[i];
  const m = mom[i];
  const mPrev = mom[i - 2];

  if (lower === null || r === null || m === null || mPrev === null) return null;

  const checks = [
    {
      name: `Próximo da banda inferior`,
      passed: v <= lower * 1.05,
      partial: v <= lower * 1.12,
      detail: `${v} vs ${lower.toFixed(1)}`,
    },
    {
      name: `RSI sobrevendido`,
      passed: r < 35,
      partial: r < 45,
      detail: `RSI=${r.toFixed(1)}`,
    },
    {
      name: `Momento virando pra cima`,
      passed: m > mPrev && m > -1.5,
      partial: m > mPrev,
      detail: `${mPrev.toFixed(2)} → ${m.toFixed(2)}`,
    },
  ];

  const passed = checks.filter(c => c.passed).length;
  const partial = checks.filter(c => c.partial && !c.passed).length;
  if (passed === 0) return null;

  return {
    active: passed >= 2,
    confidence: Math.min(100, passed * 30 + partial * 12),
    pattern: 'MEAN REVERSION',
    direction: 'over',
    message: 'Sequência esticada pra baixo. Banda inferior tocada com RSI sobrevendido — padrão clássico de retomada.',
    market: ['Over 1.5 FT', 'Over 2.5 FT', 'Ambas Sim'],
    checks,
  };
}

// ====== 2. TREND CONTINUATION ======
function detectTrendContinuation(state, i) {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null;

  const v = values[i];
  const middle = bands.middle[i];
  const r = rsi[i];
  const m = mom[i];

  if (middle === null || r === null || m === null) return null;

  const checks = [
    { name: `Acima da média`, passed: v > middle, partial: v > middle * 0.98, detail: `${v} vs ${middle.toFixed(1)}` },
    { name: `Momento positivo`, passed: m > 0.5, partial: m > 0, detail: `Mom=${m.toFixed(2)}` },
    { name: `RSI saudável (50-70)`, passed: r > 50 && r < 70, partial: r > 45 && r < 75, detail: `RSI=${r.toFixed(1)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  const partial = checks.filter(c => c.partial && !c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 28 + partial * 10),
    pattern: 'TENDÊNCIA SAUDÁVEL',
    direction: 'over',
    message: 'Sequência em alta com momento confirmado e RSI ainda não saturado.',
    market: ['Over 2.5 FT', 'Over 3.5 FT'],
    checks,
  };
}

// ====== 3. TOP REVERSAL ======
function detectTopReversal(state, i) {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null;

  const v = values[i];
  const upper = bands.upper[i];
  const r = rsi[i];
  const m = mom[i];
  const mPrev = mom[i - 2];

  if (upper === null || r === null || m === null || mPrev === null) return null;

  const checks = [
    { name: `Próximo da banda superior`, passed: v >= upper * 0.97, partial: v >= upper * 0.93, detail: `${v} vs ${upper.toFixed(1)}` },
    { name: `RSI sobrecomprado`, passed: r > 68, partial: r > 60, detail: `RSI=${r.toFixed(1)}` },
    { name: `Momento desacelerando`, passed: m < mPrev, partial: false, detail: `${mPrev.toFixed(2)} → ${m.toFixed(2)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  const partial = checks.filter(c => c.partial && !c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 30 + partial * 10),
    pattern: 'TOPO ESGOTADO',
    direction: 'under',
    message: 'Banda superior + RSI alto + momento perdendo força. Tendência de correção pra baixo.',
    market: ['Under 2.5 FT', 'Under 3.5 FT'],
    checks,
  };
}

// ====== 4. SQUEEZE BREAKOUT ======
function detectSqueezeBreakout(state, i) {
  const { bands, mom } = state;
  if (i < 30) return null;

  const widthNow = bands.upper[i] - bands.lower[i];
  let avgWidth = 0, count = 0;
  for (let k = i - 12; k <= i - 4; k++) {
    if (bands.upper[k] !== null && bands.lower[k] !== null) {
      avgWidth += bands.upper[k] - bands.lower[k];
      count++;
    }
  }
  if (count === 0) return null;
  avgWidth /= count;

  const m = mom[i];
  if (m === null || widthNow === null) return null;

  let squeezeStrength = 0;
  for (let k = i - 8; k <= i - 3; k++) {
    if (bands.upper[k] !== null) {
      const w = bands.upper[k] - bands.lower[k];
      if (w < avgWidth * 0.85) squeezeStrength++;
    }
  }

  const checks = [
    { name: `Compressão prévia`, passed: squeezeStrength >= 4, partial: squeezeStrength >= 2, detail: `${squeezeStrength}/6 rodadas` },
    { name: `Expansão atual`, passed: widthNow > avgWidth * 1.05, partial: widthNow > avgWidth, detail: `${widthNow.toFixed(1)} vs ${avgWidth.toFixed(1)}` },
    { name: `Direção clara`, passed: Math.abs(m) > 1, partial: Math.abs(m) > 0.4, detail: `Mom=${m.toFixed(2)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  const direction = m > 0 ? 'over' : 'under';
  return {
    active: true,
    confidence: Math.min(100, passed * 25 + 15),
    pattern: 'BREAKOUT DE COMPRESSÃO',
    direction,
    message: `Bandas comprimiram e agora abrem. Movimento direcional ${direction === 'over' ? 'pra mais gols' : 'pra menos gols'}.`,
    market: direction === 'over' ? ['Over 2.5 FT', 'Ambas Sim'] : ['Under 2.5 FT'],
    checks,
  };
}

// ====== 5. BEARISH DIVERGENCE ======
function detectBearishDivergence(state, i) {
  const { values, mom } = state;
  if (i < 30) return null;

  const window = 15;
  let recentMax = -Infinity, recentMaxIdx = -1;
  let prevMax = -Infinity, prevMaxIdx = -1;

  for (let k = i - 5; k <= i; k++) if (values[k] > recentMax) { recentMax = values[k]; recentMaxIdx = k; }
  for (let k = i - window; k < i - 5; k++) if (values[k] > prevMax) { prevMax = values[k]; prevMaxIdx = k; }

  if (recentMaxIdx < 0 || prevMaxIdx < 0) return null;
  const recentMom = mom[recentMaxIdx];
  const prevMom = mom[prevMaxIdx];
  if (recentMom === null || prevMom === null) return null;

  if (!(recentMax > prevMax && recentMom < prevMom)) return null;

  const valueGap = recentMax - prevMax;
  const momGap = prevMom - recentMom;

  return {
    active: true,
    confidence: Math.min(100, 40 + valueGap * 5 + momGap * 8),
    pattern: 'DIVERGÊNCIA BAIXISTA',
    direction: 'under',
    message: 'Novo pico de gols, mas momento mais fraco que no topo anterior. Sinal de exaustão.',
    market: ['Under 2.5 FT'],
    checks: [
      { name: `Topo atual maior`, passed: true, detail: `${recentMax} > ${prevMax}` },
      { name: `Momento mais fraco`, passed: true, detail: `${recentMom.toFixed(2)} < ${prevMom.toFixed(2)}` },
    ],
  };
}

// ====== 6. BULLISH DIVERGENCE ======
function detectBullishDivergence(state, i) {
  const { values, mom } = state;
  if (i < 30) return null;

  const window = 15;
  let recentMin = Infinity, recentMinIdx = -1;
  let prevMin = Infinity, prevMinIdx = -1;

  for (let k = i - 5; k <= i; k++) if (values[k] < recentMin) { recentMin = values[k]; recentMinIdx = k; }
  for (let k = i - window; k < i - 5; k++) if (values[k] < prevMin) { prevMin = values[k]; prevMinIdx = k; }

  if (recentMinIdx < 0 || prevMinIdx < 0) return null;
  const recentMom = mom[recentMinIdx];
  const prevMom = mom[prevMinIdx];
  if (recentMom === null || prevMom === null) return null;

  if (!(recentMin < prevMin && recentMom > prevMom)) return null;

  const valueGap = prevMin - recentMin;
  const momGap = recentMom - prevMom;

  return {
    active: true,
    confidence: Math.min(100, 40 + valueGap * 5 + momGap * 8),
    pattern: 'DIVERGÊNCIA ALTISTA',
    direction: 'over',
    message: 'Novo fundo de gols, mas momento mais forte que no fundo anterior. Sinal de reversão.',
    market: ['Over 2.5 FT', 'Ambas Sim'],
    checks: [
      { name: `Fundo atual menor`, passed: true, detail: `${recentMin} < ${prevMin}` },
      { name: `Momento mais forte`, passed: true, detail: `${recentMom.toFixed(2)} > ${prevMom.toFixed(2)}` },
    ],
  };
}

// ====== 7. THREE WHITE SOLDIERS (3 rodadas em alta) ======
function detectThreeWhiteSoldiers(state, i) {
  const { values, bands, mom } = state;
  if (i < 25) return null;

  // Três valores consecutivos crescentes, cada um com avanço significativo
  const a = values[i - 2], b = values[i - 1], c = values[i];
  if (!(c > b && b > a)) return null;

  const step1 = b - a;
  const step2 = c - b;
  const totalGain = c - a;

  // Cada passo precisa ser pelo menos 1 gol pra contar como "branco"
  if (step1 < 1 || step2 < 1) return null;

  const m = mom[i];
  const middle = bands.middle[i];
  if (m === null || middle === null) return null;

  const checks = [
    { name: `3 rodadas em alta`, passed: true, detail: `${a} → ${b} → ${c}` },
    { name: `Avanço total significativo`, passed: totalGain >= 4, partial: totalGain >= 2, detail: `+${totalGain} gols` },
    { name: `Acima da média`, passed: c > middle, partial: c > middle * 0.95, detail: `${c} vs ${middle.toFixed(1)}` },
    { name: `Momento positivo confirma`, passed: m > 0.3, partial: m > 0, detail: `Mom=${m.toFixed(2)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 22 + 10),
    pattern: '3 SOLDADOS BRANCOS',
    direction: 'over',
    message: '3 rodadas seguidas em alta com avanços consistentes. Continuação clássica de tendência altista.',
    market: ['Over 2.5 FT', 'Over 3.5 FT'],
    checks,
  };
}

// ====== 8. THREE BLACK CROWS (3 rodadas em queda) ======
function detectThreeBlackCrows(state, i) {
  const { values, bands, mom } = state;
  if (i < 25) return null;

  const a = values[i - 2], b = values[i - 1], c = values[i];
  if (!(c < b && b < a)) return null;

  const step1 = a - b;
  const step2 = b - c;
  const totalLoss = a - c;
  if (step1 < 1 || step2 < 1) return null;

  const m = mom[i];
  const middle = bands.middle[i];
  if (m === null || middle === null) return null;

  const checks = [
    { name: `3 rodadas em queda`, passed: true, detail: `${a} → ${b} → ${c}` },
    { name: `Queda total significativa`, passed: totalLoss >= 4, partial: totalLoss >= 2, detail: `-${totalLoss} gols` },
    { name: `Abaixo da média`, passed: c < middle, partial: c < middle * 1.05, detail: `${c} vs ${middle.toFixed(1)}` },
    { name: `Momento negativo confirma`, passed: m < -0.3, partial: m < 0, detail: `Mom=${m.toFixed(2)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 22 + 10),
    pattern: '3 CORVOS PRETOS',
    direction: 'under',
    message: '3 rodadas seguidas em queda com perdas consistentes. Continuação de tendência baixista.',
    market: ['Under 2.5 FT', 'Under 1.5 FT'],
    checks,
  };
}

// ====== 9. HAMMER (queda forte + recuperação imediata) ======
function detectHammer(state, i) {
  const { values, bands } = state;
  if (i < 25 || i < 3) return null;

  // Procura: valor caiu MUITO em 1-2 rodadas atrás, depois subiu na atual
  const recent = values[i];
  const dip = Math.min(values[i - 1], values[i - 2]);
  const before = values[i - 3];

  if (dip >= before) return null; // não houve queda
  const dropDepth = before - dip;
  const recovery = recent - dip;

  // Hammer: queda significativa + recuperação ≥ 50% da queda
  if (dropDepth < 3 || recovery < dropDepth * 0.5) return null;

  const lower = bands.lower[i];
  const middle = bands.middle[i];
  if (lower === null || middle === null) return null;

  const checks = [
    { name: `Queda significativa`, passed: dropDepth >= 5, partial: dropDepth >= 3, detail: `-${dropDepth} gols` },
    { name: `Recuperação forte`, passed: recovery >= dropDepth * 0.7, partial: recovery >= dropDepth * 0.5, detail: `+${recovery.toFixed(0)} gols` },
    { name: `Tocou banda inferior`, passed: dip <= lower * 1.05, partial: dip <= lower * 1.12, detail: `Mín=${dip}` },
    { name: `Voltando à média`, passed: recent >= middle * 0.95, partial: recent >= middle * 0.85, detail: `${recent} vs ${middle.toFixed(1)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 22 + 8),
    pattern: 'MARTELO (HAMMER)',
    direction: 'over',
    message: 'Sequência caiu forte e recuperou rápido — sinal de exaustão dos vendedores. Reversão pra mais gols.',
    market: ['Over 2.5 FT', 'Ambas Sim'],
    checks,
  };
}

// ====== 10. SHOOTING STAR (subida forte + queda imediata) ======
function detectShootingStar(state, i) {
  const { values, bands } = state;
  if (i < 25 || i < 3) return null;

  const recent = values[i];
  const peak = Math.max(values[i - 1], values[i - 2]);
  const before = values[i - 3];

  if (peak <= before) return null;
  const riseHeight = peak - before;
  const drop = peak - recent;

  if (riseHeight < 3 || drop < riseHeight * 0.5) return null;

  const upper = bands.upper[i];
  const middle = bands.middle[i];
  if (upper === null || middle === null) return null;

  const checks = [
    { name: `Subida significativa`, passed: riseHeight >= 5, partial: riseHeight >= 3, detail: `+${riseHeight} gols` },
    { name: `Queda forte logo depois`, passed: drop >= riseHeight * 0.7, partial: drop >= riseHeight * 0.5, detail: `-${drop.toFixed(0)} gols` },
    { name: `Tocou banda superior`, passed: peak >= upper * 0.95, partial: peak >= upper * 0.88, detail: `Máx=${peak}` },
    { name: `Voltando à média`, passed: recent <= middle * 1.05, partial: recent <= middle * 1.15, detail: `${recent} vs ${middle.toFixed(1)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 22 + 8),
    pattern: 'ESTRELA CADENTE',
    direction: 'under',
    message: 'Sequência disparou e caiu rápido — sinal de exaustão dos compradores. Reversão pra menos gols.',
    market: ['Under 2.5 FT', 'Under 3.5 FT'],
    checks,
  };
}

// ====== 11. CLUSTER DE TOPO (consolidação prolongada no alto) ======
function detectTopCluster(state, i) {
  const { values, bands, rsi } = state;
  if (i < 30) return null;

  // Olha últimas 5 rodadas
  const last5 = values.slice(i - 4, i + 1);
  const upper = bands.upper[i];
  const r = rsi[i];
  if (upper === null || r === null) return null;

  // Quantas das últimas 5 ficaram dentro de 8% da banda superior?
  const inTopZone = last5.filter(v => v >= upper * 0.92).length;

  if (inTopZone < 3) return null;

  const checks = [
    { name: `${inTopZone}/5 rodadas no topo da banda`, passed: inTopZone >= 4, partial: inTopZone >= 3, detail: `Banda Sup ${upper.toFixed(1)}` },
    { name: `RSI confirma sobrecompra`, passed: r > 65, partial: r > 55, detail: `RSI=${r.toFixed(1)}` },
    { name: `Variação baixa (consolidando)`, passed: (Math.max(...last5) - Math.min(...last5)) <= 4, partial: (Math.max(...last5) - Math.min(...last5)) <= 6, detail: `Δ=${Math.max(...last5) - Math.min(...last5)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 25 + 15),
    pattern: 'CLUSTER DE TOPO',
    direction: 'under',
    message: 'Várias rodadas consolidando no alto da banda. Falta de força pra romper sugere queda iminente.',
    market: ['Under 2.5 FT', 'Under 3.5 FT'],
    checks,
  };
}

// ====== 12. CLUSTER DE FUNDO (consolidação prolongada embaixo) ======
function detectBottomCluster(state, i) {
  const { values, bands, rsi } = state;
  if (i < 30) return null;

  const last5 = values.slice(i - 4, i + 1);
  const lower = bands.lower[i];
  const r = rsi[i];
  if (lower === null || r === null) return null;

  const inBottomZone = last5.filter(v => v <= lower * 1.08).length;
  if (inBottomZone < 3) return null;

  const checks = [
    { name: `${inBottomZone}/5 rodadas no fundo da banda`, passed: inBottomZone >= 4, partial: inBottomZone >= 3, detail: `Banda Inf ${lower.toFixed(1)}` },
    { name: `RSI confirma sobrevenda`, passed: r < 35, partial: r < 45, detail: `RSI=${r.toFixed(1)}` },
    { name: `Variação baixa (consolidando)`, passed: (Math.max(...last5) - Math.min(...last5)) <= 4, partial: (Math.max(...last5) - Math.min(...last5)) <= 6, detail: `Δ=${Math.max(...last5) - Math.min(...last5)}` },
  ];

  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;

  return {
    active: true,
    confidence: Math.min(100, passed * 25 + 15),
    pattern: 'CLUSTER DE FUNDO',
    direction: 'over',
    message: 'Várias rodadas consolidando no fundo da banda. Esgotamento dos vendedores sugere reversão.',
    market: ['Over 2.5 FT', 'Ambas Sim'],
    checks,
  };
}

// ============================================================
// 13️⃣ TOQUE NA ZONA S/R (rebote)
// ============================================================
// Quando o valor toca uma zona S/R com força e recua, indica
// que a zona está "ativa". Direção depende de qual tipo de zona:
// - Toque na zona INFERIOR (fundo) → bounce esperado pra cima (Over)
// - Toque na zona SUPERIOR (topo) → rejeição esperada pra baixo (Under)
function detectSRTouch(state, i) {
  if (!state.zones || state.zones.length === 0) return null;
  if (i < 25) return null;

  const v = state.values[i];
  const prevV = state.values[i - 1];

  // Encontra a zona mais próxima do valor atual
  let nearestZone = null, minDist = Infinity;
  state.zones.forEach(z => {
    const dist = v >= z.low && v <= z.high ? 0 : Math.min(Math.abs(v - z.low), Math.abs(v - z.high));
    if (dist < minDist) { minDist = dist; nearestZone = z; }
  });

  if (!nearestZone || minDist > 1.5) return null;

  // Direção esperada: se zona é "baixa" da série, esperamos bounce (over)
  const seriesMid = (Math.max(...state.values) + Math.min(...state.values)) / 2;
  const isLowerZone = nearestZone.center < seriesMid;
  const direction = isLowerZone ? 'over' : 'under';

  // Sinal de bounce: tocou e já começou a se afastar na direção certa
  const bouncing = direction === 'over' ? v > prevV : v < prevV;

  if (!bouncing) return null;

  const confidence = Math.min(100, 30 + nearestZone.strength * 0.5 + (bouncing ? 20 : 0));

  return {
    active: true,
    confidence,
    pattern: 'TOQUE EM ZONA S/R',
    direction,
    message: `Valor ${v} tocou ${isLowerZone ? 'suporte' : 'resistência'} na zona SRZ${nearestZone.id} (${nearestZone.touches} toques históricos) e está ${direction === 'over' ? 'subindo' : 'descendo'}.`,
    market: direction === 'over' ? ['Over 2.5 FT', 'Ambas Sim'] : ['Under 2.5 FT'],
    checks: [
      { name: `Zona S/R próxima (dist ${minDist.toFixed(1)})`, passed: true, detail: `SRZ${nearestZone.id} centro ${nearestZone.center.toFixed(1)}` },
      { name: `Força da zona (${nearestZone.strength}/100)`, passed: nearestZone.strength >= 50, detail: `${nearestZone.touches} toques` },
      { name: 'Movimento de bounce confirmado', passed: bouncing, detail: `${prevV} → ${v}` },
    ],
  };
}

// ============================================================
// 14️⃣ QUEBRA DE ZONA S/R (breakout)
// ============================================================
// Quando o valor cruza uma zona S/R com força (volume = momento),
// indica continuação da quebra.
function detectSRBreak(state, i) {
  if (!state.zones || state.zones.length === 0) return null;
  if (i < 25) return null;

  const v = state.values[i];
  const prevV = state.values[i - 1];
  const m = state.mom[i];
  if (m === null) return null;

  // Procura zona que foi cruzada entre prevV e v
  for (const z of state.zones) {
    const crossedUp = prevV < z.low && v > z.high;       // quebrou pra cima
    const crossedDown = prevV > z.high && v < z.low;     // quebrou pra baixo
    if (!crossedUp && !crossedDown) continue;

    const direction = crossedUp ? 'over' : 'under';
    // Confirmação: momento na direção da quebra
    const momConfirms = crossedUp ? m > 0 : m < 0;
    if (!momConfirms) continue;

    const confidence = Math.min(100, 40 + z.strength * 0.4 + Math.abs(m) * 5);

    return {
      active: true,
      confidence,
      pattern: 'QUEBRA DE ZONA S/R',
      direction,
      message: `Valor cruzou a zona SRZ${z.id} (${z.touches} toques histórico) com momento ${m > 0 ? 'positivo' : 'negativo'}. Quebra estrutural ${direction === 'over' ? 'pra mais gols' : 'pra menos gols'}.`,
      market: direction === 'over' ? ['Over 2.5 FT', 'Over 3.5 FT'] : ['Under 2.5 FT'],
      checks: [
        { name: `Zona ${crossedUp ? 'rompida pra cima' : 'rompida pra baixo'}`, passed: true, detail: `SRZ${z.id}` },
        { name: 'Momento confirma direção', passed: momConfirms, detail: `Mom=${m.toFixed(2)}` },
        { name: `Força da zona (${z.strength}/100)`, passed: z.strength >= 40, detail: `${z.touches} toques` },
      ],
    };
  }
  return null;
}

// ============================================================
// 15️⃣ TOQUE EM TRENDLINE (rebote)
// ============================================================
// Detecta quando o valor toca uma trendline projetada e recua na
// direção da tendência (continuação).
function detectTrendlineTouch(state, i) {
  if (!state.trendlines || state.trendlines.length === 0) return null;
  if (i < 25) return null;

  const v = state.values[i];
  const prevV = state.values[i - 1];

  for (const line of state.trendlines) {
    // Calcula o valor da trendline no índice i
    const slope = (line.p2.value - line.p1.value) / (line.p2.index - line.p1.index);
    const lineVal = line.p2.value + slope * (i - line.p2.index);
    const dist = Math.abs(v - lineVal);
    if (dist > 1.5) continue;

    const isResistance = line.type === 'resistance';
    const direction = isResistance ? 'under' : 'over';
    // Bounce: se é resistência, esperamos que o valor recue pra baixo
    const bouncing = isResistance ? v < prevV : v > prevV;
    if (!bouncing) continue;

    const confidence = Math.min(85, 50 + (1.5 - dist) * 15);

    return {
      active: true,
      confidence,
      pattern: 'TOQUE EM TRENDLINE',
      direction,
      message: `Valor ${v} tocou trendline de ${isResistance ? 'resistência' : 'suporte'} (${line.label}) e ${bouncing ? 'já recua' : 'parou'}. Tendência tende a continuar respeitando a linha.`,
      market: direction === 'over' ? ['Over 2.5 FT'] : ['Under 2.5 FT'],
      checks: [
        { name: `Distância da linha (${dist.toFixed(1)})`, passed: dist < 1, detail: `linha em ${lineVal.toFixed(1)}` },
        { name: 'Movimento de rebote', passed: bouncing, detail: `${prevV} → ${v}` },
        { name: `Tipo: ${line.label}`, passed: line.label === 'macro', detail: line.type },
      ],
    };
  }
  return null;
}

// ============================================================
// 16️⃣ CRUZAMENTO BIG ODDS (Over 2.5 + Over 3.5 ≥ 70%)
// ============================================================
// Sinal especial que dispara quando AMBOS os mercados Over 2.5 e
// Over 3.5 têm probabilidade estimada >= 70%. Cenário ideal pra
// apostas combinadas (Big Odds = altas multiplicações).
//
// COMO ESTIMAMOS A PROBABILIDADE (sem odds reais):
// O valor da série = total de gols nas últimas 20 rodadas.
//   - Valor 50 → média 2.5 gols/jogo (limiar do Over 2.5)
//   - Valor 60 → média 3.0 gols/jogo (folga pra Over 2.5; perto do Over 3.5)
//   - Valor 70 → média 3.5 gols/jogo (limiar do Over 3.5)
//
// Combinamos o NÍVEL atual (acima de quanto?) com:
//   - Momento (subindo/descendo)
//   - RSI (saudável vs saturado)
//   - Tendência (acima/abaixo da média da série)
// pra obter um score 0-100 que aproxima a probabilidade.

function estimateMarketProbabilities(state, i) {
  const v = state.values[i];
  const mom = state.mom[i];
  const rsi = state.rsi[i];
  const middle = state.bands.middle[i];

  if (mom === null || rsi === null || middle === null) return null;

  // Média histórica da série (estabiliza em ~46 nos seus dados)
  const seriesAvg = state.values.reduce((a, b) => a + b, 0) / state.values.length;

  // ============= CALCULO BASE =============
  // Threshold conceitual: valor=50 ↔ média 2.5 gols/jogo (limiar do Over 2.5)
  //                        valor=70 ↔ média 3.5 gols/jogo (limiar do Over 3.5)
  // Quando o valor está bem acima desses thresholds, a probabilidade sobe.

  // P(Over 2.5) base: distância do valor ao threshold 50, ajustada
  // por uma função sigmoide-ish que satura em 0 e 100
  const distFromOver25 = v - 50;
  let probOver25 = 50 + distFromOver25 * 3; // cada gol acima de 50 = +3pp
  // Bonus por momento positivo (subindo)
  probOver25 += Math.max(-15, Math.min(15, mom * 4));
  // Bonus por RSI saudável (50-70)
  if (rsi > 50 && rsi < 75) probOver25 += (rsi - 50) * 0.4;
  // Penalidade por RSI saturado (sinal de exaustão)
  if (rsi >= 75) probOver25 -= (rsi - 75) * 0.8;
  // Bonus por estar acima da média móvel da janela
  if (v > middle) probOver25 += 5;

  probOver25 = Math.max(0, Math.min(100, probOver25));

  // P(Over 3.5): mesma lógica, threshold 55 (calibrado pra séries reais
  // onde valores raramente passam de 65). Penalty menor que antes
  // pra que o sinal seja factível.
  const distFromOver35 = v - 55;
  let probOver35 = 50 + distFromOver35 * 3.5;
  probOver35 += Math.max(-15, Math.min(15, mom * 4));
  if (rsi > 50 && rsi < 75) probOver35 += (rsi - 50) * 0.5;
  if (rsi >= 75) probOver35 -= (rsi - 75) * 0.8;
  // Bonus por estar muito acima da média histórica
  if (v > seriesAvg * 1.10) probOver35 += 6;
  if (v > seriesAvg * 1.20) probOver35 += 6; // bonus adicional pra valores extremos

  probOver35 = Math.max(0, Math.min(100, probOver35));

  return { probOver25, probOver35, level: v, momentum: mom, rsi };
}

function detectBigOddsCrossover(state, i) {
  if (i < 25) return null;

  const probs = estimateMarketProbabilities(state, i);
  if (!probs) return null;

  // CRUZAMENTO: ambos os mercados precisam estar >= 70%
  const THRESHOLD = 70;
  const crossing = probs.probOver25 >= THRESHOLD && probs.probOver35 >= THRESHOLD;
  if (!crossing) return null;

  // Confiança = média dos dois (ambos altos = sinal forte)
  const confidence = Math.round((probs.probOver25 + probs.probOver35) / 2);

  return {
    active: true,
    confidence,
    pattern: 'CRUZAMENTO BIG ODDS',
    direction: 'over',
    backtestType: 'sustainHighLevel', // backtest custom: mede manutenção de nível alto
    sustainThreshold: 50, // valor mínimo a sustentar nas próximas rodadas
    message: `🎯 BIG ODDS: ambos os mercados convergiram acima de 70%. Over 2.5 com ${probs.probOver25.toFixed(0)}% e Over 3.5 com ${probs.probOver35.toFixed(0)}%. Cenário ideal pra apostas combinadas com alta multiplicação.`,
    market: [
      `Over 2.5 FT (${probs.probOver25.toFixed(0)}%)`,
      `Over 3.5 FT (${probs.probOver35.toFixed(0)}%)`,
      'Combinada O2.5 + O3.5',
    ],
    checks: [
      { name: 'Prob. Over 2.5 ≥ 70%', passed: probs.probOver25 >= 70, detail: `${probs.probOver25.toFixed(0)}%` },
      { name: 'Prob. Over 3.5 ≥ 70%', passed: probs.probOver35 >= 70, detail: `${probs.probOver35.toFixed(0)}%` },
      { name: 'Nível elevado', passed: probs.level >= 55, detail: `${probs.level} gols/janela` },
      { name: 'Momento e RSI alinhados', passed: probs.momentum > 0 && probs.rsi > 50, detail: `Mom ${probs.momentum.toFixed(2)} · RSI ${probs.rsi.toFixed(0)}` },
    ],
  };
}

// ====== EXPORTA TODOS ======
const DETECTORS = [
  detectMeanReversion,
  detectTrendContinuation,
  detectTopReversal,
  detectSqueezeBreakout,
  detectBearishDivergence,
  detectBullishDivergence,
  detectThreeWhiteSoldiers,
  detectThreeBlackCrows,
  detectHammer,
  detectShootingStar,
  detectTopCluster,
  detectBottomCluster,
  detectSRTouch,
  detectSRBreak,
  detectTrendlineTouch,
  detectBigOddsCrossover,
];
