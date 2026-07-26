import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AllyConfig } from './types.js';

const CONFIG_FILENAME = 'ally.config.json';

export const DEFAULT_CONFIG: AllyConfig = {
  targetLevel: 'AA',
  ignoreRules: [],
  ignorePaths: [],
  defaultLang: 'en',
  autofix: 'on',
};

const allyConfigSchema = z.object({
  targetLevel: z.enum(['A', 'AA', 'AAA']).optional(),
  ignoreRules: z.array(z.string()).optional(),
  ignorePaths: z.array(z.string()).optional(),
  defaultLang: z.string().optional(),
  autofix: z.enum(['on', 'off']).optional(),
  appUrl: z.string().optional(),
  projectName: z.string().optional(),
  evaluation: z.object({
    runtime: z.boolean().optional(),
    routes: z.array(z.string().min(1)).max(50).optional(),
    timeoutMs: z.number().int().min(1_000).max(120_000).optional(),
    testScripts: z.array(z.string().min(1)).max(20).optional(),
  }).optional(),
});

export function loadConfig(root: string): AllyConfig {
  const configPath = join(root, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid ally.config.json: failed to parse JSON`);
  }

  const result = allyConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid ally.config.json: ${issues}`);
  }

  return { ...DEFAULT_CONFIG, ...result.data };
}
