import type { Severity, Confidence, WcagLevel } from './types.js';
export const SEVERITY_WEIGHT: Record<Severity, number> = { blocker: 10, critical: 5, serious: 3, moderate: 1, minor: 0.5 };
export const CONFIDENCE_WEIGHT: Record<Confidence, number> = { certain: 1, high: 0.8, needs_review: 0.5 };
export const LEVEL_ORDER: Record<WcagLevel, number> = { A: 1, AA: 2, AAA: 3 };
