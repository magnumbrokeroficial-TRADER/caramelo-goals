import { DetectorState, DetectorResult } from '@/types/detector';
export function detectMeanReversion(state: DetectorState, i: number): DetectorResult | null {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null;
  const v = values[i];
  const lower = bands.lower[i];
  const r = rsi[i];
  const m = mom[i];
  const mPrev = mom[i - 2];
  if (lower === null || r === null || m === null) return null;
  const checks = [
    { name: 'Valor próximo da banda inferior', passed: v <= lower * 1.05, partial: v <= lower * 1.12, detail: `${v} vs ${lower.toFixed(1)}` },
    { name: 'RSI sobrevendido (<35)', passed: r < 35, partial: r < 45, detail: `RSI=${r.toFixed(1)}` },
    { name: 'Momento virando pra cima', passed: m > mPrev! && m > -1.5, partial: m > mPrev!, detail: `${mPrev?.toFixed(2)} → ${m.toFixed(2)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 30 + checks.filter(c => c.partial && !c.passed).length * 12), pattern: 'MEAN REVERSION', direction: 'over', message: 'Sequência de poucos gols está esticada.', market: ['Over 1.5 FT', 'Over 2.5 FT', 'Ambas Sim'], checks };
}
