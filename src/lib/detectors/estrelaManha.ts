import { DetectorState, DetectorResult } from '@/types/detector';
import { RSI } from '@/lib/indicators/technical';
export function detectEstrelaManha(state: DetectorState, i: number): DetectorResult | null {
  const { values, rsi } = state;
  if (i < 4) return null;
  const [v1, v2, v3] = values.slice(i - 2, i + 1);
  const r = rsi[i];
  const checks = [
    { name: 'Fundo local', passed: v2 < v1 && v2 < v3, partial: v2 < v1 || v2 < v3, detail: `${v1} → ${v2} → ${v3}` },
    { name: 'Recuperação > 50%', passed: (v3 - v2) / (v1 - v2) > 0.5, partial: (v3 - v2) / (v1 - v2) > 0.3, detail: `${(((v3-v2)/(v1-v2))*100).toFixed(0)}%` },
    { name: 'RSI saindo de sobrevenda', passed: r !== null && r > 30, partial: r !== null && r > 25, detail: `RSI=${r?.toFixed(1)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  return { active: true, confidence: Math.min(100, passed * 33), pattern: 'ESTRELA DA MANHÃ', direction: 'over', message: 'Formação de fundo com recuperação.', market: ['Over 2.5 FT', 'Ambas Sim'], checks };
}
