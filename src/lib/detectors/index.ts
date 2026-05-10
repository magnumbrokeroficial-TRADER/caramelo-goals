import { DetectorState, DetectorResult } from '@/types/detector';
import { detectMeanReversion } from './meanReversion';
import { detectTrendContinuation } from './trendContinuation';
import { detectTopReversal } from './topReversal';
import { detectSqueezeBreakout } from './squeezeBreakout';
import { detectBearishDivergence } from './bearishDivergence';
import { detectBullishDivergence } from './bullishDivergence';
import { detectTresSoldados } from './tresSoldados';
import { detectMartelo } from './martelo';
import { detectEngolfoAlta } from './engolfoAlta';
import { detectEstrelaManha } from './estrelaManha';

export const ALL_DETECTORS = [
  detectMeanReversion,
  detectTrendContinuation,
  detectTopReversal,
  detectSqueezeBreakout,
  detectBearishDivergence,
  detectBullishDivergence,
  detectTresSoldados,
  detectMartelo,
  detectEngolfoAlta,
  detectEstrelaManha,
];

export function scanAll(state: DetectorState): DetectorResult[] {
  const results: DetectorResult[] = [];
  for (let i = 25; i < state.values.length; i++) {
    for (const detector of ALL_DETECTORS) {
      const result = detector(state, i);
      if (result && result.active && result.confidence >= 35) {
        results.push(result);
      }
    }
  }
  return results;
}
