/* ============================================================
   🎲 SCORE PREDICTORS — Previsão de Placares Específicos
   ============================================================
   Categoria especializada de detectores que respondem a pergunta:
   "Qual é o placar mais provável da próxima partida?"

   Diferente dos detectores tradicionais (que indicam direção:
   over/under), esses sinais focam em CENÁRIOS DE PLACAR ESPECÍFICO:

   • PLACAR 0x0       — jogo "morno" sem gols
   • UNDER 3.5        — jogo defensivo (até 3 gols total)
   • OVER 3.5         — jogo movimentado (4+ gols)
   • OVER 4.5         — placar alto (5+ gols)
   • 5+ GOLS          — goleada (5 ou mais gols totais)

   COMO FUNCIONA:
   Cada detector combina:
   1. Estado dos indicadores (nível, momento, RSI)
   2. Histórico recente do mosaico (frequência empírica)

   O score final é uma média ponderada onde:
   - 60% vem da análise técnica (estado da série)
   - 40% vem da frequência histórica do placar nos últimos jogos

   PROBABILIDADE MÍNIMA: 60% (alinhado com filtro do projeto)
============================================================ */

/* ----- HELPER: extrai placares recentes do grid do mosaico ----- */

function extractRecentScores(mosaicGrid, lastN = 30) {
  if (!mosaicGrid || mosaicGrid.length === 0) return [];
  // Pega os últimos N placares de TODAS as linhas, considerando que
  // as colunas mais à direita são as mais recentes
  const flat = [];
  for (let r = 0; r < mosaicGrid.length; r++) {
    for (let c = 0; c < mosaicGrid[r].length; c++) {
      flat.push(mosaicGrid[r][c]);
    }
  }
  return flat.slice(-lastN);
}

/* ----- HELPER: frequência empírica de cada cenário ----- */

function scoreFrequencies(scores) {
  const total = scores.length || 1;
  let zero = 0, over15 = 0, over25 = 0, over35 = 0, over45 = 0, fivePlus = 0;

  scores.forEach(s => {
    const tg = s.totalGoals;
    if (tg === 0) zero++;
    if (tg >= 2) over15++;
    if (tg >= 3) over25++;
    if (tg >= 4) over35++;
    if (tg >= 5) over45++;
    if (tg >= 5) fivePlus++; // >=5 = "mais de 5 gols" (5 incluso)
  });

  return {
    zero:     (zero / total) * 100,
    over15:   (over15 / total) * 100,
    over25:   (over25 / total) * 100,
    over35:   (over35 / total) * 100,
    over45:   (over45 / total) * 100,
    fivePlus: (fivePlus / total) * 100,
    totalSamples: total,
  };
}


/* ============================================================
   17️⃣ PREVISÃO 0x0 (JOGO ZERADO)
   ============================================================ */

function predictZeroZero(state, i) {
  if (i < 25) return null;
  const v = state.values[i];
  const mom = state.mom[i];
  const rsi = state.rsi[i];
  const middle = state.bands.middle[i];
  const lower = state.bands.lower[i];
  if (mom === null || rsi === null || lower === null) return null;

  const seriesAvg = state.values.reduce((a, b) => a + b, 0) / state.values.length;
  const recentScores = state.recentScores || [];
  const freq = scoreFrequencies(recentScores);

  // Componente TÉCNICO (60%): valor baixo + momento descendente + RSI fraco
  let techScore = 0;
  if (v < seriesAvg - 6) techScore += 30;        // bem abaixo da média
  else if (v < seriesAvg - 3) techScore += 20;
  if (mom < -1) techScore += 25;                  // momento muito negativo
  else if (mom < 0) techScore += 15;
  if (rsi < 35) techScore += 25;                  // RSI sobrevendido
  else if (rsi < 45) techScore += 15;
  if (v <= lower * 1.05) techScore += 20;         // tocando banda inferior

  // Componente HISTÓRICO (40%): frequência recente de 0x0
  // Se nos últimos jogos tivemos vários 0x0, é mais provável continuar
  const histScore = freq.zero >= 12 ? 100 : freq.zero >= 6 ? 70 : freq.zero >= 3 ? 40 : 15;

  const confidence = Math.round(techScore * 0.6 + histScore * 0.4);
  if (confidence < 60) return null;

  return {
    active: true,
    confidence,
    pattern: 'PREVISÃO 0x0',
    direction: 'under',
    category: 'score_prediction',
    backtestType: 'sustainLowLevel',
    sustainThreshold: 38,
    message: `Cenário de jogo zerado: valor ${v} bem abaixo da média (${seriesAvg.toFixed(0)}) com momento ${mom.toFixed(2)} e RSI ${rsi.toFixed(0)}. Histórico recente: ${freq.zero.toFixed(0)}% dos jogos terminaram 0x0.`,
    market: ['Resultado 0x0', 'Under 0.5 FT', 'Under 1.5 FT'],
    checks: [
      { name: `Valor abaixo da média (${seriesAvg.toFixed(0)})`, passed: v < seriesAvg - 6, detail: `${v}` },
      { name: 'Momento descendente forte', passed: mom < -1, detail: `Mom=${mom.toFixed(2)}` },
      { name: 'RSI sobrevendido (<35)', passed: rsi < 35, detail: `RSI=${rsi.toFixed(0)}` },
      { name: `Histórico: 0x0 frequente (${freq.zero.toFixed(0)}%)`, passed: freq.zero >= 6, detail: `em ${freq.totalSamples} jogos` },
    ],
  };
}

/* ============================================================
   18️⃣ PREVISÃO UNDER 3.5 (JOGO DEFENSIVO)
   ============================================================ */

function predictUnder35(state, i) {
  if (i < 25) return null;
  const v = state.values[i];
  const mom = state.mom[i];
  const rsi = state.rsi[i];
  const middle = state.bands.middle[i];
  if (mom === null || rsi === null || middle === null) return null;

  const seriesAvg = state.values.reduce((a, b) => a + b, 0) / state.values.length;
  const recentScores = state.recentScores || [];
  const freq = scoreFrequencies(recentScores);

  let techScore = 0;
  if (v <= seriesAvg) techScore += 25;
  if (v < middle) techScore += 15;
  if (mom <= 0.3) techScore += 25;
  if (rsi >= 35 && rsi <= 55) techScore += 25;
  // Sem extremos: posição "neutra"
  if (Math.abs(mom) < 1.5) techScore += 10;

  // Histórico: % de jogos UNDER 3.5 = 100 - over35
  const under35Pct = 100 - freq.over35;
  const histScore = under35Pct >= 75 ? 100 : under35Pct >= 60 ? 70 : 40;

  const confidence = Math.round(techScore * 0.6 + histScore * 0.4);
  if (confidence < 60) return null;

  return {
    active: true,
    confidence,
    pattern: 'PREVISÃO UNDER 3.5',
    direction: 'under',
    category: 'score_prediction',
    backtestType: 'sustainLowLevel',
    sustainThreshold: 50,
    message: `Cenário de jogo defensivo: valor ${v} próximo da média com momento neutro/negativo. ${under35Pct.toFixed(0)}% dos jogos recentes tiveram menos de 4 gols.`,
    market: ['Under 3.5 FT', 'Under 2.5 FT', 'Resultado 1-1', 'Resultado 0-0'],
    checks: [
      { name: 'Valor abaixo da média', passed: v <= seriesAvg, detail: `${v} vs ${seriesAvg.toFixed(0)}` },
      { name: 'Momento neutro/negativo', passed: mom <= 0.3, detail: `Mom=${mom.toFixed(2)}` },
      { name: 'RSI em zona neutra (35-55)', passed: rsi >= 35 && rsi <= 55, detail: `RSI=${rsi.toFixed(0)}` },
      { name: `Histórico: Under 3.5 frequente (${under35Pct.toFixed(0)}%)`, passed: under35Pct >= 60, detail: `em ${freq.totalSamples} jogos` },
    ],
  };
}

/* ============================================================
   19️⃣ PREVISÃO OVER 3.5 (JOGO MOVIMENTADO)
   ============================================================ */

function predictOver35(state, i) {
  if (i < 25) return null;
  const v = state.values[i];
  const mom = state.mom[i];
  const rsi = state.rsi[i];
  const middle = state.bands.middle[i];
  if (mom === null || rsi === null || middle === null) return null;

  const seriesAvg = state.values.reduce((a, b) => a + b, 0) / state.values.length;
  const recentScores = state.recentScores || [];
  const freq = scoreFrequencies(recentScores);

  let techScore = 0;
  if (v > seriesAvg + 3) techScore += 25;
  if (v > middle) techScore += 15;
  if (mom > 1) techScore += 25;
  else if (mom > 0) techScore += 12;
  if (rsi >= 55 && rsi <= 75) techScore += 25;
  if (v >= 50) techScore += 10;

  const histScore = freq.over35 >= 35 ? 100 : freq.over35 >= 25 ? 75 : freq.over35 >= 15 ? 50 : 25;

  const confidence = Math.round(techScore * 0.6 + histScore * 0.4);
  if (confidence < 60) return null;

  return {
    active: true,
    confidence,
    pattern: 'PREVISÃO OVER 3.5',
    direction: 'over',
    category: 'score_prediction',
    backtestType: 'sustainHighLevel',
    sustainThreshold: 50,
    message: `Cenário de jogo movimentado: valor ${v} acima da média com momento ${mom.toFixed(2)}. ${freq.over35.toFixed(0)}% dos jogos recentes tiveram 4+ gols.`,
    market: ['Over 3.5 FT', 'Over 2.5 FT', 'Ambas Sim'],
    checks: [
      { name: 'Valor acima da média', passed: v > seriesAvg + 3, detail: `${v} vs ${seriesAvg.toFixed(0)}` },
      { name: 'Momento positivo', passed: mom > 1, detail: `Mom=${mom.toFixed(2)}` },
      { name: 'RSI em zona altista', passed: rsi >= 55 && rsi <= 75, detail: `RSI=${rsi.toFixed(0)}` },
      { name: `Histórico: Over 3.5 frequente (${freq.over35.toFixed(0)}%)`, passed: freq.over35 >= 25, detail: `em ${freq.totalSamples} jogos` },
    ],
  };
}

/* ============================================================
   20️⃣ PREVISÃO OVER 4.5 (PLACAR ALTO)
   ============================================================ */

function predictOver45(state, i) {
  if (i < 25) return null;
  const v = state.values[i];
  const mom = state.mom[i];
  const rsi = state.rsi[i];
  const upper = state.bands.upper[i];
  if (mom === null || rsi === null || upper === null) return null;

  const seriesAvg = state.values.reduce((a, b) => a + b, 0) / state.values.length;
  const recentScores = state.recentScores || [];
  const freq = scoreFrequencies(recentScores);

  let techScore = 0;
  if (v >= seriesAvg + 6) techScore += 30;
  if (v >= 54) techScore += 15;
  if (mom > 2) techScore += 25;
  else if (mom > 1) techScore += 12;
  if (rsi >= 60 && rsi <= 78) techScore += 20;
  // Próximo da banda superior — sinal extremo
  if (v >= upper * 0.95) techScore += 15;

  const histScore = freq.over45 >= 18 ? 100 : freq.over45 >= 10 ? 75 : freq.over45 >= 5 ? 50 : 20;

  const confidence = Math.round(techScore * 0.6 + histScore * 0.4);
  if (confidence < 60) return null;

  return {
    active: true,
    confidence,
    pattern: 'PREVISÃO OVER 4.5',
    direction: 'over',
    category: 'score_prediction',
    backtestType: 'sustainHighLevel',
    sustainThreshold: 54,
    message: `Cenário de placar alto: valor ${v} bem acima da média (${seriesAvg.toFixed(0)}) com momento forte (${mom.toFixed(2)}). ${freq.over45.toFixed(0)}% dos jogos recentes tiveram 5+ gols.`,
    market: ['Over 4.5 FT', 'Over 3.5 FT', 'Ambas Sim'],
    checks: [
      { name: `Valor muito alto (${seriesAvg.toFixed(0)}+ 6)`, passed: v >= seriesAvg + 6, detail: `${v}` },
      { name: 'Momento muito positivo', passed: mom > 2, detail: `Mom=${mom.toFixed(2)}` },
      { name: 'RSI saudável forte', passed: rsi >= 60 && rsi <= 78, detail: `RSI=${rsi.toFixed(0)}` },
      { name: `Histórico: Over 4.5 (${freq.over45.toFixed(0)}%)`, passed: freq.over45 >= 10, detail: `em ${freq.totalSamples} jogos` },
    ],
  };
}

/* ============================================================
   2️⃣1️⃣ PREVISÃO 5+ GOLS (GOLEADA)
   ============================================================ */

function predictFiveGoals(state, i) {
  if (i < 25) return null;
  const v = state.values[i];
  const mom = state.mom[i];
  const rsi = state.rsi[i];
  const upper = state.bands.upper[i];
  const prev3 = state.values.slice(Math.max(0, i - 3), i);
  if (mom === null || rsi === null || upper === null) return null;

  const seriesAvg = state.values.reduce((a, b) => a + b, 0) / state.values.length;
  const recentScores = state.recentScores || [];
  const freq = scoreFrequencies(recentScores);

  // Sequência crescente nas últimas 3 rodadas?
  const climbing = prev3.length === 3 && prev3[0] < prev3[1] && prev3[1] <= prev3[2];

  let techScore = 0;
  if (v >= seriesAvg + 8) techScore += 35;
  if (v >= 56) techScore += 12;
  if (mom > 3) techScore += 25;
  else if (mom > 2) techScore += 12;
  if (climbing) techScore += 15;
  if (rsi >= 65 && rsi <= 80) techScore += 13;

  const histScore = freq.fivePlus >= 12 ? 100 : freq.fivePlus >= 7 ? 70 : freq.fivePlus >= 3 ? 40 : 15;

  const confidence = Math.round(techScore * 0.6 + histScore * 0.4);
  if (confidence < 60) return null;

  return {
    active: true,
    confidence,
    pattern: 'PREVISÃO 5+ GOLS',
    direction: 'over',
    category: 'score_prediction',
    backtestType: 'sustainHighLevel',
    sustainThreshold: 56,
    message: `🔥 Cenário de goleada: valor ${v} extremo, ${climbing ? 'subindo nas últimas 3 rodadas' : 'em zona alta'}, momento ${mom.toFixed(2)}. ${freq.fivePlus.toFixed(0)}% dos jogos recentes tiveram 5+ gols totais.`,
    market: ['Over 4.5 FT', 'Over 5.5 FT', '3+ Gols Cada Time', 'Resultado 3-2 / 4-2 / 5+ x +'],
    checks: [
      { name: `Valor extremo (média+8)`, passed: v >= seriesAvg + 8, detail: `${v} vs ${(seriesAvg + 8).toFixed(0)}` },
      { name: 'Momento explosivo', passed: mom > 3, detail: `Mom=${mom.toFixed(2)}` },
      { name: 'Sequência crescente', passed: climbing, detail: prev3.join('→') },
      { name: `Histórico: 5+ gols (${freq.fivePlus.toFixed(0)}%)`, passed: freq.fivePlus >= 7, detail: `em ${freq.totalSamples} jogos` },
    ],
  };
}


/* ============================================================
   EXPORTA TODOS OS PREDITORES
============================================================ */

const SCORE_PREDICTORS = [
  predictZeroZero,
  predictUnder35,
  predictOver35,
  predictOver45,
  predictFiveGoals,
];
