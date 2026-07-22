#!/usr/bin/env node
// Dogfood gate — scan the Ally dashboard with the Ally engine itself.

import { scanFiles, discoverFiles } from '../packages/engine/dist/index.js';

const root = new URL('..', import.meta.url).pathname;
const discovered = await discoverFiles(root + 'apps/web', []);
const files = discovered.map(f => 'apps/web/' + f);
const report = await scanFiles(root, files, { projectName: 'ally-dashboard' });

const blocking = report.findings.filter(f =>
  f.status !== 'dismissed' &&
  f.confidence === 'certain' &&
  ['blocker', 'critical', 'serious'].includes(f.severity)
);

for (const f of blocking) {
  console.error(
    `${f.severity} ${f.ruleId} ${f.location.file}:${f.location.startLine} — ${f.message}`
  );
}

console.log(
  `Ally dogfood: score ${report.summary.score}/100, ` +
  `${report.findings.length} findings, ${blocking.length} blocking`
);

process.exit(blocking.length ? 1 : 0);
