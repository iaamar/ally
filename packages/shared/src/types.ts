export type Severity = 'blocker' | 'critical' | 'serious' | 'moderate' | 'minor';
export type Confidence = 'certain' | 'high' | 'needs_review';
export type FixClass = 'SAFE_AUTOFIX' | 'SUGGEST' | 'NEEDS_HUMAN';
export type Modality = 'screen_reader' | 'keyboard' | 'low_vision' | 'motor' | 'cognitive';
export type WcagLevel = 'A' | 'AA' | 'AAA';

export interface SourceLocation { file: string; startLine: number; startCol: number; endLine: number; endCol: number; }
export interface TextEdit { file: string; startLine: number; startCol: number; endLine: number; endCol: number; replacement: string; }
export interface AutoFix { title: string; fingerprint: string; edits: TextEdit[]; }

export interface Finding {
  fingerprint: string;
  /** Stable across snippet edits; optional only for pre-migration persisted findings. */
  matchKey?: string;
  /** Position within an identical match-key group. */
  ordinal?: number;
  ruleId: string; wcag: string[]; level: WcagLevel;
  severity: Severity; confidence: Confidence; impact: Modality[];
  message: string; location: SourceLocation; snippet: string;
  clusterKey: string; fixClass: FixClass; fix?: AutoFix; pass: 1 | 2 | 3;
  status?: 'open' | 'confirmed' | 'dismissed';
  priority?: number;
  suggestedFixText?: string;
}

export interface ReasoningPacket {
  packetId: string; findingFingerprint: string; hypothesis: string;
  evidence: { snippet: string; location: SourceLocation; context?: string };
  rubric: string[]; citations: string[];
  verdictSchema: { confirm: 'boolean'; reasoning: 'string'; suggestedFix: 'string|null' };
}
export interface Verdict { packetId: string; confirm: boolean; reasoning: string; suggestedFix?: string | null; }

export interface ScanSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byLevel: Record<WcagLevel, number>;
  clusters: { clusterKey: string; count: number; ruleIds: string[] }[];
  score: number;
}
export interface ScanReport {
  scanId: string; createdAt: string; projectName: string;
  target: { root: string; files: number }; toolVersion: string;
  findings: Finding[]; packets: ReasoningPacket[]; summary: ScanSummary;
}
