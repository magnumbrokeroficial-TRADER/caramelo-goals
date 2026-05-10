import { DetectorState, DetectorResult } from '@/types/detector';
export function detectBullishDivergence(state: DetectorState, i: number): DetectorResult | null {
  const { values, mom } = state;
  if (i < 30) return null;
  let recentMin = Infinity, recentMinIdx = -1, prevMin = Infinity, prevMinIdx = -1;
  for (let k = i - 5; k <= i; k++) { if (values[k] < recentMin) { recentMin = values[k]; recentMinIdx = k; } }
  for (let k = i - 15; k < i - 5; k++) { if (values[k] < prevMin) { prevMin = values[k]; prevMinIdx = k; } }
  if (recentMinIdx < 0 || prevMinIdx < 0) return null;
  const recentMom = mom[recentMinIdx], prevMom = mom[prevMinIdx];
  if (recentMom === null || prevMom === null || !(recentMin < prevMin) || !(recentMom > prevMom)) return null;
  return {
    active: true,
    confidence: Math.min(100, 40 + (prevMin - recentMin) * 5 + (recentMom - prevMom) * 8),
    pattern: 'DIVERGÊNCIA ALTISTA',
    direction: 'over',
    message: 'Novo fundo de gols com momento mais forte que antes.',
    market: ['Over 2.5 FT', 'Ambas Sim'],
    checks: [
      { name: 'Fundo atual menor', passed: true, partial: false, detail: `${recentMin} < ${prevMin}` },
      { name: 'Momento atual mais forte', passed: true, partial: false, detail: `${recentMom.toFixed(2)} > ${prevMom.toFixed(2)}` }
    ]
  };
}
