// lib/strategy.ts
// Núcleo matemático da estratégia Under/Over baseado no mosaico 20x6.

export interface Game {
  hour: number;     // 0-23
  column: number;   // 1-20 (J1 a J20)
  minute: number;   // 1, 4, 7, ..., 58
  goals: number;
}

export interface SignalComponents {
  vertical: number;
  heat: number;
  lateral: number;
  z: number;
}

export interface ProbabilityResult {
  score: number;
  pOver: number;     // 15..85
  pUnder: number;    // 15..85
  band: string;
  action: string;
  components: SignalComponents;
}

// ── Helpers ───────────────────────────────────────────────────────
export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

const tanh = Math.tanh;
export function normalize(x: number, scale = 1): number {
  return tanh(x / scale);
}

// ── Componentes do sinal ──────────────────────────────────────────

/**
 * Sinal vertical: média ponderada dos últimos 3 deltas da coluna.
 * columnHistory[0] = H-1, [1] = H-2, [2] = H-3, [3] = H-4
 */
export function verticalSignal(columnHistory: number[]): number {
  if (columnHistory.length < 4) {
    // Fallback com menos história
    if (columnHistory.length === 3) {
      return ((columnHistory[0] - columnHistory[1]) * 2 + (columnHistory[1] - columnHistory[2])) / 3;
    }
    if (columnHistory.length === 2) {
      return columnHistory[0] - columnHistory[1];
    }
    return 0;
  }
  const d1 = columnHistory[0] - columnHistory[1];
  const d2 = columnHistory[1] - columnHistory[2];
  const d3 = columnHistory[2] - columnHistory[3];
  return (3 * d1 + 2 * d2 + d3) / 6;
}

/**
 * Heat: hora atual vs hora anterior até a coluna i-1 (acumulado parcial).
 */
export function heatSignal(
  currentHourGoals: number[],
  previousHourGoals: number[],
  uptoColumn: number
): number {
  if (uptoColumn <= 1) return 0;
  const cur = currentHourGoals.slice(0, uptoColumn - 1).reduce((a, b) => a + b, 0);
  const prev = previousHourGoals.slice(0, uptoColumn - 1).reduce((a, b) => a + b, 0);
  return (cur - prev) / Math.max(1, prev);
}

/**
 * Lateral: momentum das 2 colunas anteriores na mesma hora vs sua média histórica.
 */
export function lateralSignal(
  currentHour: number[],
  histories: number[][], // histories[col-1] = lista de gols históricos
  targetColumn: number
): number {
  if (targetColumn < 2) return 0;
  let total = 0;
  const offsets = targetColumn >= 3 ? [1, 2] : [1];
  for (const off of offsets) {
    const idx = targetColumn - 1 - off;
    if (idx < 0) continue;
    const cur = currentHour[idx] ?? 0;
    const hist = (histories[idx] || []).slice(0, 3);
    total += cur - mean(hist);
  }
  return total;
}

/**
 * Z-score: média histórica da coluna vs média global.
 */
export function zSignal(columnHistory: number[], globalMean: number, globalStd: number): number {
  if (!columnHistory.length || globalStd === 0) return 0;
  return (mean(columnHistory) - globalMean) / globalStd;
}

// ── Combinação final ──────────────────────────────────────────────

export function probabilityOver(components: SignalComponents): ProbabilityResult {
  const score =
    0.40 * normalize(components.vertical, 1.5) +
    0.25 * normalize(components.heat, 0.5) +
    0.20 * normalize(components.lateral, 2.0) +
    0.15 * normalize(components.z, 1.0);

  const pOverRaw = 50 + score * 35;
  const pOver = Math.max(15, Math.min(85, pOverRaw));
  const pUnder = 100 - pOver;

  const { band, action } = classify(pOver);

  return {
    score: round(score, 3),
    pOver: round(pOver, 2),
    pUnder: round(pUnder, 2),
    band,
    action,
    components: {
      vertical: round(components.vertical, 3),
      heat: round(components.heat, 3),
      lateral: round(components.lateral, 3),
      z: round(components.z, 3),
    },
  };
}

function classify(pOver: number): { band: string; action: string } {
  if (pOver >= 75) return { band: 'Over muito forte', action: 'Entrada cheia' };
  if (pOver >= 65) return { band: 'Over forte', action: 'Entrada cheia' };
  if (pOver >= 55) return { band: 'Over moderado', action: 'Entrada parcial' };
  if (pOver >= 45) return { band: 'Zona morta', action: 'Não operar' };
  if (pOver >= 36) return { band: 'Under moderado', action: 'Entrada parcial' };
  if (pOver >= 26) return { band: 'Under forte', action: 'Entrada cheia' };
  return { band: 'Under muito forte', action: 'Entrada cheia' };
}

function round(x: number, d: number): number {
  const m = 10 ** d;
  return Math.round(x * m) / m;
}
