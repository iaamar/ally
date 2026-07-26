import { z } from 'zod';
const zSeverity = z.enum(['blocker', 'critical', 'serious', 'moderate', 'minor']);
const zConfidence = z.enum(['certain', 'high', 'needs_review']);
const zFixClass = z.enum(['SAFE_AUTOFIX', 'SUGGEST', 'NEEDS_HUMAN']);
const zModality = z.enum(['screen_reader', 'keyboard', 'low_vision', 'motor', 'cognitive']);
const zLevel = z.enum(['A', 'AA', 'AAA']);
const zLoc = z.object({ file: z.string(), startLine: z.number().int(), startCol: z.number().int(), endLine: z.number().int(), endCol: z.number().int() });
const zEdit = zLoc.extend({ replacement: z.string() });
const zFix = z.object({ title: z.string(), fingerprint: z.string(), edits: z.array(zEdit) });
export const zFinding = z.object({
  fingerprint: z.string(), ruleId: z.string(), wcag: z.array(z.string()), level: zLevel,
  severity: zSeverity, confidence: zConfidence, impact: z.array(zModality),
  message: z.string(), location: zLoc, snippet: z.string(), clusterKey: z.string(),
  fixClass: zFixClass, fix: zFix.optional(), pass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(['open', 'confirmed', 'dismissed']).optional(), priority: z.number().optional(),
  suggestedFixText: z.string().optional(),
});
export const zPacket = z.object({
  packetId: z.string(), findingFingerprint: z.string(), hypothesis: z.string(),
  evidence: z.object({ snippet: z.string(), location: zLoc, context: z.string().optional() }),
  rubric: z.array(z.string()), citations: z.array(z.string()),
  verdictSchema: z.object({ confirm: z.literal('boolean'), reasoning: z.literal('string'), suggestedFix: z.literal('string|null') }),
});
export const zVerdict = z.object({ packetId: z.string(), confirm: z.boolean(), reasoning: z.string().min(1), suggestedFix: z.string().nullable().optional() });
export const zSummary = z.object({
  total: z.number().int(), bySeverity: z.record(zSeverity, z.number().int()), byLevel: z.record(zLevel, z.number().int()),
  clusters: z.array(z.object({ clusterKey: z.string(), count: z.number().int(), ruleIds: z.array(z.string()) })), score: z.number(),
});
export const zScanReport = z.object({
  scanId: z.string(), createdAt: z.string(), projectName: z.string(),
  target: z.object({ root: z.string(), files: z.number().int() }), toolVersion: z.string(),
  findings: z.array(zFinding), packets: z.array(zPacket), summary: zSummary,
});
export const zScanIngest = z.object({ projectName: z.string().min(1).max(120), report: zScanReport });

export const zEvaluationIngest = z.object({
  projectName: z.string().min(1).max(120),
  scanId: z.string().uuid().optional(),
  contract: z.object({
    id: z.string().min(1).max(120),
    baselineScanId: z.string().min(1).max(120),
  }).passthrough(),
  evaluation: z.object({
    contractId: z.string().min(1).max(120),
    attempt: z.number().int().positive(),
    passed: z.boolean(),
    gates: z.object({
      contractedFindingsResolved: z.boolean(),
      noFindingRegressions: z.boolean(),
      runtimePassed: z.boolean(),
      testsPassed: z.boolean(),
    }),
    runtime: z.unknown(),
    tests: z.array(z.unknown()),
  }).passthrough(),
});
