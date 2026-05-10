import { DetectorState, DetectorResult } from '@/types/detector';
export function detectSqueezeBreakout(state: DetectorState, i: number): DetectorResult | null {
  const { values, bands, mom } = state;
  if (i < 30) return null;
  const widthNow = bands.upper[i]! - bands.lower[i]!;
  let avgWidth = 0, count = 0;
  for (let k = i - 12; k <= i - 4; k++) {
    if (bands.upper[k] !== null && bands.lower[k] !== null) { avgWidth += bands.upper[k]! - bands.lower[k]!; count++; }
  }
  if (count === 0) return null;
  avgWidth /= count;
  const m = mom[i];
  if (m === null) return null;
  let squeezeStrength = 0;
  for (let k = i - 8; k <= i - 3; k++) { if (bands.upper[k] !== null) { const w = bands.upper[k]! - bands.lower[k]!; if (w < avgWidth * 0.85) squeezeStrength++; } }
  const checks = [
    { name: `Compressão prévia (${squeezeStrength}/6)`, passed: squeezeStrength >= 4, partial: squeezeStrength >= 2, detail: `Largura média ${avgWidth.toFixed(1)}` },
    { name: 'Expansão atual da banda', passed: widthNow > avgWidth * 1.05, partial: widthNow > avgWidth, detail: `Atual ${widthNow.toFixed(1)}` },
    { name: 'Direção do momento clara', passed: Math.abs(m) > 1, partial: Math.abs(m) > 0.4, detail: `Mom=${m.toFixed(2)}` },
  ];
  const passed = checks.filter(c => c.passed).length;
  if (passed < 2) return null;
  const direction = m > 0 ? 'over' : 'under';
  return { active: true, confidence: Math.min(100, passed * 25 + 15), pattern: 'BREAKOUT DE COMPRESSÃO', direction, message: `Bandas comprimidas agora expandindo com força.`, market: direction === 'over' ? ['Over 2.5 FT', 'Ambas Sim'] : ['Under 2.5 FT'], checks };
}
