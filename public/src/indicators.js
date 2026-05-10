/* ============================================================
   📐 INDICADORES TÉCNICOS
   ============================================================
   Funções matemáticas puras. Recebem array de valores e
   retornam array de mesmo tamanho com nulls onde não há
   dados suficientes pra calcular ainda (ex: RSI(14) precisa
   de pelo menos 14 pontos antes do primeiro cálculo).
============================================================ */

// Média móvel simples (Simple Moving Average)
function SMA(values, period) {
  const result = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result[i] = slice.reduce((s, v) => s + v, 0) / period;
  }
  return result;
}

// Média móvel exponencial (mais responsiva a mudanças recentes)
function EMA(values, period) {
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  // Primeiro EMA = SMA das primeiras N entradas
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// Bandas de Bollinger (média ± k * desvio padrão)
function bollingerBands(values, period = 20, k = 1.8) {
  const upper = new Array(values.length).fill(null);
  const middle = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = mean + std * k;
    middle[i] = mean;
    lower[i] = mean - std * k;
  }
  return { upper, middle, lower };
}

// RSI clássico (Relative Strength Index)
function RSI(values, period = 14) {
  const result = new Array(values.length).fill(null);
  if (values.length < period + 1) return result;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }
  return result;
}

// Momento = MM rápida - MM lenta (MACD adaptado pra séries curtas)
function momentum(values, fast = 9, slow = 21) {
  const fastMA = SMA(values, fast);
  const slowMA = SMA(values, slow);
  return values.map((_, i) =>
    (fastMA[i] !== null && slowMA[i] !== null) ? fastMA[i] - slowMA[i] : null
  );
}

// Posição na banda — 0 = banda inferior, 100 = banda superior
function bandPosition(value, lower, upper) {
  if (lower === null || upper === null || upper === lower) return 50;
  return ((value - lower) / (upper - lower)) * 100;
}

// Largura da banda (medida de volatilidade)
function bandWidth(upper, lower) {
  if (upper === null || lower === null) return null;
  return upper - lower;
}

// Empacota todos os indicadores num único objeto de estado
function calculateAllIndicators(values, params = {}) {
  const cfg = {
    rsiPeriod: params.rsiPeriod || 14,
    bollingerWindow: params.bollingerWindow || 20,
    bollingerStd: params.bollingerStd || 1.8,
    maFast: params.maFast || 9,
    maSlow: params.maSlow || 21,
  };

  return {
    values,
    config: cfg,
    rsi: RSI(values, cfg.rsiPeriod),
    bands: bollingerBands(values, cfg.bollingerWindow, cfg.bollingerStd),
    mom: momentum(values, cfg.maFast, cfg.maSlow),
    mm9: SMA(values, cfg.maFast),
    mm21: SMA(values, cfg.maSlow),
    ema12: EMA(values, 12),
    ema26: EMA(values, 26),
  };
}
