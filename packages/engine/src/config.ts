import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AllyConfig } from './types.js';

const CONFIG_FILENAME = 'ally.config.json';

const DEFAULTS: AllyConfig = {
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
});

export function loadConfig(root: string): AllyConfig {
  const configPath = join(root, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return { ...DEFAULTS };
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

  return { ...DEFAULTS, ...result.data };
}
