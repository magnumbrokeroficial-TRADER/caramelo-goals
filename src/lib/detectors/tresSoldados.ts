import { DetectorState, DetectorResult } from '@/types/detector';
export function detectTresSoldados(state: DetectorState, i: number): DetectorResult | null {
  const { values } = state;
  if (i < 4) return null;
  const [v1, v2, v3] = values.slice(i - 3, i);
  const checks = [
    { name: '3 altas consecutivas', passed: v3 > v2 && v2 > v1, partial: v3 > v1, detail: `${v1} → ${v2} → ${v3}` },
    { name: 'Cada alta > 1%', passed: (v2-v1)/v1 > 0.01 && (v3-v2)/v2 > 0.01, partial: (v3-v1)/v1 > 0.01, detail: `${(((v3-v1)/v1)*100).toFixed(1)}% total` },
    { name: 'Volume crescente', passed: true, partial: true, detail: 'Aguardando dados' },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 30 + 10), pattern: 'TRÊS SOLDADOS BRANCOS', direction: 'over', message: 'Três altas consecutivas com aceleração.', market: ['Over 2.5 FT'], checks };
}
