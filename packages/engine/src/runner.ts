import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Finding, ReasoningPacket, ScanReport } from '@ally/shared';
import type { AllyConfig } from './types.js';
import { DEFAULT_CONFIG, loadConfig } from './config.js';
import { discoverFiles } from './discover.js';
import { parseSource } from './parse.js';
import { RULES, draftToFinding } from './rules/index.js';
import { prioritize, summarize } from './prioritize.js';

function mergeConfig(base: AllyConfig, overrides?: Partial<AllyConfig>): AllyConfig {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    ignoreRules: overrides.ignoreRules ?? base.ignoreRules,
    ignorePaths: overrides.ignorePaths ?? base.ignorePaths,
  };
}

export interface SourceFileInput {
  path: string;
  content: string;
}

function runSources(
  sources: SourceFileInput[],
  config: AllyConfig,
): { findings: Finding[]; packets: ReasoningPacket[] } {
  const findings: Finding[] = [];
  const packets: ReasoningPacket[] = [];
  const ignoredRules = new Set(config.ignoreRules);

  for (const sourceFile of sources) {
    const doc = parseSource(sourceFile.path, sourceFile.content);
    const ctx = { config, doc };

    for (const rule of RULES) {
      if (ignoredRules.has(rule.meta.id)) continue;

      // Per-element checks
      for (const elem of doc.elements) {
        const draft = rule.check(elem, ctx);
        if (draft) {
          const { finding, packet } = draftToFinding(draft, rule, sourceFile.path, config);
          findings.push(finding);
          if (packet) packets.push(packet);
        }
      }

      // Document-level checks
      if (rule.docCheck) {
        const drafts = rule.docCheck(doc, ctx);
        for (const draft of drafts) {
          const { finding, packet } = draftToFinding(draft, rule, sourceFile.path, config);
          findings.push(finding);
          if (packet) packets.push(packet);
        }
      }
    }
  }

  return { findings, packets };
}

export async function scanProject(
  root: string,
  overrides?: Partial<AllyConfig>,
): Promise<ScanReport> {
  const config = mergeConfig(loadConfig(root), overrides);
  const files = await discoverFiles(root, config.ignorePaths);
  return buildReport(root, files, config);
}

export async function scanFiles(
  root: string,
  files: string[],
  overrides?: Partial<AllyConfig>,
): Promise<ScanReport> {
  const config = mergeConfig(loadConfig(root), overrides);
  return buildReport(root, files, config);
}

export async function scanSources(
  projectName: string,
  sources: SourceFileInput[],
  overrides?: Partial<AllyConfig>,
): Promise<ScanReport> {
  const config = mergeConfig(
    { ...DEFAULT_CONFIG, projectName },
    overrides,
  );
  return buildSourceReport(projectName, sources, config);
}

function buildReport(
  root: string,
  files: string[],
  config: AllyConfig,
): ScanReport {
  const sources = files.map((relFile) => ({
    path: relFile,
    content: readFileSync(join(root, relFile), 'utf-8'),
  }));
  return buildSourceReport(root, sources, config);
}

function buildSourceReport(
  root: string,
  sources: SourceFileInput[],
  config: AllyConfig,
): ScanReport {
  const { findings, packets } = runSources(sources, config);
  const prioritized = prioritize(findings, config.targetLevel);
  const summary = summarize(prioritized, sources.length);

  return {
    scanId: `scan_${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    projectName: config.projectName ?? basename(root),
    target: { root, files: sources.length },
    toolVersion: '0.1.0',
    findings: prioritized,
    packets,
    summary,
  };
}
