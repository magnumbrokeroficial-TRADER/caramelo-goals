export function SMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result[i] = slice.reduce((s, v) => s + v, 0) / period;
  }
  return result;
}

export function BollingerBands(values: number[], period = 20, k = 1.8) {
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const middle: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
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

export function RSI(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
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

export function Momentum(values: number[], fast = 9, slow = 21): (number | null)[] {
  const fastMA = SMA(values, fast);
  const slowMA = SMA(values, slow);
  return values.map((_, i) =>
    (fastMA[i] !== null && slowMA[i] !== null) ? fastMA[i]! - slowMA[i]! : null
  );
}

export function bandPosition(value: number, lower: number | null, upper: number | null): number {
  if (lower === null || upper === null || upper === lower) return 50;
  return ((value - lower) / (upper - lower)) * 100;
}
