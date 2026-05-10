import { DetectorState, DetectorResult } from '@/types/detector';
import { SMA } from '@/lib/indicators/technical';
export function detectEngolfoAlta(state: DetectorState, i: number): DetectorResult | null {
  const { values } = state;
  if (i < 3) return null;
  const [v1, v2, v3] = values.slice(i - 2, i + 1);
  const sma10 = SMA(values, 10)[i];
  const checks = [
    { name: '2 baixas seguidas', passed: v2 < v1, partial: v2 <= v1, detail: `${v1} → ${v2}` },
    { name: 'Alta absorve queda', passed: v3 > v1, partial: v3 > v2, detail: `${v2} → ${v3}` },
    { name: 'Fechou acima da média', passed: sma10 !== null && v3 > sma10!, partial: sma10 !== null && v3 > sma10! * 0.95, detail: `MM10: ${sma10?.toFixed(1)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 30 + 10), pattern: 'ENGOLFO DE ALTA', direction: 'over', message: 'Alta forte supera o valor inicial após duas quedas.', market: ['Over 2.5 FT'], checks };
}
