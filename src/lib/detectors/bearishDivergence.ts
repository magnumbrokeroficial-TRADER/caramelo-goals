import { DetectorState, DetectorResult } from '@/types/detector';
export function detectBearishDivergence(state: DetectorState, i: number): DetectorResult | null {
  const { values, mom } = state;
  if (i < 30) return null;
  let recentMax = -Infinity, recentMaxIdx = -1, prevMax = -Infinity, prevMaxIdx = -1;
  for (let k = i - 5; k <= i; k++) { if (values[k] > recentMax) { recentMax = values[k]; recentMaxIdx = k; } }
  for (let k = i - 15; k < i - 5; k++) { if (values[k] > prevMax) { prevMax = values[k]; prevMaxIdx = k; } }
  if (recentMaxIdx < 0 || prevMaxIdx < 0) return null;
  const recentMom = mom[recentMaxIdx], prevMom = mom[prevMaxIdx];
  if (recentMom === null || prevMom === null || !(recentMax > prevMax) || !(recentMom < prevMom)) return null;
  return {
    active: true,
    confidence: Math.min(100, 40 + (recentMax - prevMax) * 5 + (prevMom - recentMom) * 8),
    pattern: 'DIVERGÊNCIA BAIXISTA',
    direction: 'under',
    message: 'Novo pico de gols com momento mais fraco que antes.',
    market: ['Under 2.5 FT'],
    checks: [
      { name: 'Topo atual maior', passed: true, partial: false, detail: `${recentMax} > ${prevMax}` },
      { name: 'Momento atual mais fraco', passed: true, partial: false, detail: `${recentMom.toFixed(2)} < ${prevMom.toFixed(2)}` }
    ]
  };
}
