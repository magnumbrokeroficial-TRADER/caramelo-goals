import { DetectorState, DetectorResult } from '@/types/detector';
export function detectTopReversal(state: DetectorState, i: number): DetectorResult | null {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null;
  const v = values[i];
  const upper = bands.upper[i];
  const r = rsi[i];
  const m = mom[i];
  const mPrev = mom[i - 2];
  if (upper === null || r === null || m === null) return null;
  const checks = [
    { name: 'Valor próximo da banda superior', passed: v >= upper * 0.97, partial: v >= upper * 0.93, detail: `${v} vs ${upper.toFixed(1)}` },
    { name: 'RSI sobrecomprado (>68)', passed: r > 68, partial: r > 60, detail: `RSI=${r.toFixed(1)}` },
    { name: 'Momento desacelerando', passed: mPrev !== null && m < mPrev, partial: false, detail: `${mPrev?.toFixed(2)} → ${m.toFixed(2)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 30 + checks.filter(c => c.partial && !c.passed).length * 10), pattern: 'TOPO ESGOTADO', direction: 'under', message: 'Sequência de muitos gols saturada.', market: ['Under 2.5 FT', 'Under 3.5 FT'], checks };
}
