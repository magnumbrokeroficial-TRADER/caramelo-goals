/* ============================================================
   🧠 SIGNAL ENGINE — Orquestrador
   ============================================================
   Pega o estado calculado (indicadores) e roda TODOS os
   detectores em cada ponto da série. Filtra por confiança
   mínima e retorna a lista ordenada do mais recente ao mais
   antigo.
============================================================ */

function scanAllPatterns(state, data, minConfidence = 35) {
  const allSignals = [];

  // Combina detectores tradicionais + score predictors
  const allDetectors = [
    ...DETECTORS,
    ...(typeof SCORE_PREDICTORS !== 'undefined' ? SCORE_PREDICTORS : []),
  ];

  for (let i = 25; i < state.values.length; i++) {
    for (const detector of allDetectors) {
      const result = detector(state, i);
      if (result && result.active && result.confidence >= minConfidence) {
        allSignals.push({
          ...result,
          time: data[i].time,
          dataIndex: i,
          value: state.values[i],
        });
      }
    }
  }

  return allSignals.sort((a, b) => b.dataIndex - a.dataIndex);
}

/* ============================================================
   🧹 DEDUP / FILTRO DE PROXIMIDADE
   ============================================================
   Reduz poluição visual no gráfico. Estratégia:
   1. Agrupa sinais por janela de "minSpacing" rodadas
   2. Em cada grupo, mantém apenas o de MAIOR confiança
   3. Aplica limite máximo absoluto (topN)
   Retorna lista enxuta pra renderizar marcadores.
============================================================ */

function dedupeSignals(signals, minSpacing = 4, topN = 25) {
  if (!signals || signals.length === 0) return [];

  // Ordena cronologicamente
  const chrono = [...signals].sort((a, b) => a.dataIndex - b.dataIndex);

  const kept = [];
  let windowStart = chrono[0].dataIndex;
  let bestInWindow = chrono[0];

  for (let i = 1; i < chrono.length; i++) {
    const sig = chrono[i];
    if (sig.dataIndex - windowStart >= minSpacing) {
      // Fecha janela atual, abre uma nova começando neste sinal
      kept.push(bestInWindow);
      windowStart = sig.dataIndex;
      bestInWindow = sig;
    } else {
      // Ainda na mesma janela: mantém o de maior confiança
      if (sig.confidence > bestInWindow.confidence) {
        bestInWindow = sig;
      }
    }
  }
  // Não esquece a última janela aberta
  kept.push(bestInWindow);

  // Aplica limite global: pega os topN de maior confiança
  return kept
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topN)
    .sort((a, b) => b.dataIndex - a.dataIndex);
}

/* ============================================================
   🧪 BACKTEST
   ============================================================
   Para cada sinal histórico, olha as próximas N rodadas e
   verifica se a direção sugerida acertou:
   - 'over'  → acerta se média futura > valor no momento
   - 'under' → acerta se média futura < valor no momento
============================================================ */

function backtestSignals(signals, values, horizon = 3) {
  let wins = 0, losses = 0;

  signals.forEach(sig => {
    const i = sig.dataIndex;
    if (i + horizon >= values.length) {
      sig.backtestResult = 'pending';
      return;
    }

    const baseline = values[i];
    let futureSum = 0;
    for (let k = 1; k <= horizon; k++) futureSum += values[i + k];
    const futureAvg = futureSum / horizon;

    let won;
    // Backtest customizado para padrões específicos
    if (sig.backtestType === 'sustainHighLevel') {
      // Para BIG ODDS / Over: sucesso é manter o nível alto nas próximas rodadas
      const threshold = sig.sustainThreshold || 50;
      won = futureAvg >= threshold;
    } else if (sig.backtestType === 'sustainLowLevel') {
      // Para 0x0 / Under: sucesso é manter o nível baixo nas próximas rodadas
      const threshold = sig.sustainThreshold || 45;
      won = futureAvg <= threshold;
    } else {
      // Backtest direcional padrão
      won = sig.direction === 'over' ? futureAvg > baseline : futureAvg < baseline;
    }

    sig.backtestResult = won ? 'win' : 'loss';
    if (won) wins++; else losses++;
  });

  const total = wins + losses;
  return {
    total,
    wins,
    losses,
    accuracy: total > 0 ? (wins / total) * 100 : 0,
  };
}

// Estatísticas separadas por padrão (útil pra ver quais funcionam melhor)
function backtestByPattern(signals) {
  const byPattern = {};
  signals.forEach(sig => {
    if (!byPattern[sig.pattern]) {
      byPattern[sig.pattern] = { total: 0, wins: 0, direction: sig.direction };
    }
    byPattern[sig.pattern].total++;
    if (sig.backtestResult === 'win') byPattern[sig.pattern].wins++;
  });

  Object.keys(byPattern).forEach(p => {
    byPattern[p].accuracy = byPattern[p].total > 0
      ? (byPattern[p].wins / byPattern[p].total) * 100
      : 0;
  });

  return byPattern;
}

/* ============================================================
   🎯 FILTRO POR ACURÁCIA (max 40% erro)
   ============================================================
   Roda backtest individual de cada padrão, calcula taxa de
   acerto, e retorna apenas sinais de padrões com accuracy
   >= minAccuracy (default 60%).
============================================================ */

function filterByAccuracy(signals, values, horizon = 3, minAccuracy = 60) {
  if (!signals.length) return { filtered: [], stats: {} };

  // Backtest temporário só pra calcular accuracy por padrão
  const tempSignals = signals.map(s => ({ ...s }));
  backtestSignals(tempSignals, values, horizon);
  const byPattern = backtestByPattern(tempSignals);

  // Padrões aprovados (accuracy >= threshold E pelo menos 3 amostras)
  const approved = new Set();
  Object.entries(byPattern).forEach(([pattern, stats]) => {
    if (stats.total >= 3 && stats.accuracy >= minAccuracy) {
      approved.add(pattern);
    }
  });

  return {
    filtered: signals.filter(s => approved.has(s.pattern)),
    stats: byPattern,
    approvedPatterns: Array.from(approved),
  };
}

/* ============================================================
   🤖 AUTO-SELEÇÃO DO MELHOR GRUPO DE DETECTORES
   ============================================================
   Roda backtest de TODOS os detectores e retorna os topN
   com maior accuracy. Útil pra automaticamente "calibrar"
   quais detectores usar baseado no histórico real.
============================================================ */

function autoSelectBestDetectors(state, data, options = {}) {
  const {
    topN = 5,
    minSamples = 3,
    horizon = 3,
    minConfidence = 35,
  } = options;

  const allSignals = scanAllPatterns(state, data, minConfidence);
  const tempSignals = allSignals.map(s => ({ ...s }));
  backtestSignals(tempSignals, state.values, horizon);
  const stats = backtestByPattern(tempSignals);

  // Ranqueia padrões por accuracy (mas só os com amostras suficientes)
  const ranked = Object.entries(stats)
    .filter(([_, s]) => s.total >= minSamples)
    .map(([pattern, s]) => ({ pattern, ...s }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return {
    top: ranked.slice(0, topN).map(r => r.pattern),
    rankings: ranked,
    allStats: stats,
  };
}
