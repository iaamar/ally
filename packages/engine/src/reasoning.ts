import type { ScanReport, Verdict } from '@ally/shared';
import { zVerdict } from '@ally/shared';
import { summarize } from './prioritize.js';

/**
 * Apply agent LLM verdicts to reasoning packets in a scan report.
 *
 * Pure function: returns a new ScanReport without mutating the input.
 *
 * Validation is all-or-nothing:
 * 1. Parse every verdict through zVerdict (rejects malformed input).
 * 2. Check that every packetId exists in the report. If any are unknown,
 *    throw before making any changes.
 *
 * For each verdict:
 * - confirm: true  -> status 'confirmed'; upgrade confidence from
 *   'needs_review' to 'high'; store suggestedFix as suggestedFixText.
 * - confirm: false -> status 'dismissed'.
 *
 * Consumed packets are removed; summary is recomputed.
 */
export function applyVerdicts(report: ScanReport, verdicts: Verdict[]): ScanReport {
  // Step 1: Validate all verdicts against the Zod schema
  const parsed = verdicts.map((v) => zVerdict.parse(v));

  // Step 2: Build a set of packet IDs in the report for fast lookup
  const reportPacketIds = new Set(report.packets.map((p) => p.packetId));

  // Step 3: Check all packetIds exist — fail before any mutation
  const unknownIds = parsed
    .map((v) => v.packetId)
    .filter((id) => !reportPacketIds.has(id));

  if (unknownIds.length > 0) {
    throw new Error(`Unknown packetIds: ${unknownIds.join(', ')}`);
  }

  // Step 4: Build lookup maps
  // packetId -> verdict
  const verdictByPacketId = new Map(parsed.map((v) => [v.packetId, v]));
  // packetId -> findingFingerprint
  const packetToFingerprint = new Map(
    report.packets.map((p) => [p.packetId, p.findingFingerprint]),
  );
  // findingFingerprint -> verdict (resolved through packet)
  const verdictByFingerprint = new Map<string, (typeof parsed)[number]>();
  for (const [packetId, verdict] of verdictByPacketId) {
    const fingerprint = packetToFingerprint.get(packetId)!;
    verdictByFingerprint.set(fingerprint, verdict);
  }

  // Step 5: Apply verdicts to findings (immutable — new array of new objects)
  const newFindings = report.findings.map((f) => {
    const verdict = verdictByFingerprint.get(f.fingerprint);
    if (!verdict) return { ...f };

    if (verdict.confirm) {
      return {
        ...f,
        status: 'confirmed' as const,
        confidence: f.confidence === 'needs_review' ? ('high' as const) : f.confidence,
        ...(verdict.suggestedFix ? { suggestedFixText: verdict.suggestedFix } : {}),
      };
    } else {
      return {
        ...f,
        status: 'dismissed' as const,
      };
    }
  });

  // Step 6: Remove consumed packets
  const consumedPacketIds = new Set(parsed.map((v) => v.packetId));
  const newPackets = report.packets.filter((p) => !consumedPacketIds.has(p.packetId));

  // Step 7: Recompute summary
  const newSummary = summarize(newFindings, report.target.files);

  return {
    ...report,
    findings: newFindings,
    packets: newPackets,
    summary: newSummary,
  };
}
