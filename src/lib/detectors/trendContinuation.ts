import { DetectorState, DetectorResult } from '@/types/detector';
export function detectTrendContinuation(state: DetectorState, i: number): DetectorResult | null {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null;
  const v = values[i];
  const middle = bands.middle[i];
  const r = rsi[i];
  const m = mom[i];
  if (middle === null || r === null || m === null) return null;
  const checks = [
    { name: 'Acima da média da janela', passed: v > middle, partial: v > middle * 0.98, detail: `${v} vs ${middle.toFixed(1)}` },
    { name: 'Momento positivo', passed: m > 0.5, partial: m > 0, detail: `Mom=${m.toFixed(2)}` },
    { name: 'RSI saudável (50-70)', passed: r > 50 && r < 70, partial: r > 45 && r < 75, detail: `RSI=${r.toFixed(1)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 28 + checks.filter(c => c.partial && !c.passed).length * 10), pattern: 'TENDÊNCIA SAUDÁVEL', direction: 'over', message: 'Sequência em alta com espaço para continuar.', market: ['Over 2.5 FT', 'Over 3.5 FT'], checks };
}
