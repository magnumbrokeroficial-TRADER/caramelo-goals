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
];
