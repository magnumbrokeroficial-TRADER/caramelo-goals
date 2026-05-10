import { DetectorState, DetectorResult } from '@/types/detector';
export function detectMartelo(state: DetectorState, i: number): DetectorResult | null {
  const { values } = state;
  if (i < 3) return null;
  const [anterior, penultimo, ultimo] = values.slice(i - 2, i + 1);
  const checks = [
    { name: 'Queda anterior forte (>5%)', passed: (anterior - penultimo) / anterior > 0.05, partial: (anterior - penultimo) / anterior > 0.03, detail: `${anterior} → ${penultimo}` },
    { name: 'Recuperação atual', passed: ultimo > penultimo, partial: ultimo >= penultimo, detail: `${penultimo} → ${ultimo}` },
    { name: 'Fechou acima de 50%', passed: ultimo > (anterior + penultimo) / 2, partial: ultimo > penultimo + (anterior - penultimo) * 0.3, detail: `Méd: ${((anterior+penultimo)/2).toFixed(1)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 33), pattern: 'MARTELO', direction: 'over', message: 'Queda forte seguida de recuperação.', market: ['Over 2.5 FT', 'Ambas Sim'], checks };
}
