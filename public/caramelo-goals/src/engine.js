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

  for (let i = 25; i < state.values.length; i++) {
    for (const detector of DETECTORS) {
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

    const won = sig.direction === 'over'
      ? futureAvg > baseline
      : futureAvg < baseline;

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
