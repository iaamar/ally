import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverFiles } from '../src/discover.js';
import { loadConfig } from '../src/config.js';

let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'ally-discover-'));
  await mkdir(join(tmp, 'src'), { recursive: true });
  await mkdir(join(tmp, 'public'), { recursive: true });
  await mkdir(join(tmp, 'node_modules', 'x'), { recursive: true });
  await mkdir(join(tmp, 'dist'), { recursive: true });

  await writeFile(join(tmp, 'src', 'App.tsx'), '<div/>');
  await writeFile(join(tmp, 'public', 'index.html'), '<html></html>');
  await writeFile(join(tmp, 'node_modules', 'x', 'y.tsx'), '<div/>');
  await writeFile(join(tmp, 'dist', 'out.tsx'), '<div/>');
  await writeFile(join(tmp, 'src', 'util.ts'), 'export const x = 1;');
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('discoverFiles', () => {
  it('finds tsx and html, skips node_modules and dist', async () => {
    const files = await discoverFiles(tmp, []);
    expect(files).toEqual(['public/index.html', 'src/App.tsx']);
  });

  it('respects ignorePaths', async () => {
    const files = await discoverFiles(tmp, ['public/**']);
    expect(files).toEqual(['src/App.tsx']);
  });
});

describe('loadConfig', () => {
  it('returns defaults when no config file', () => {
    const config = loadConfig(tmp);
    expect(config.targetLevel).toBe('AA');
    expect(config.ignoreRules).toEqual([]);
    expect(config.ignorePaths).toEqual([]);
    expect(config.defaultLang).toBe('en');
    expect(config.autofix).toBe('on');
  });

  it('merges config file over defaults', async () => {
    await writeFile(join(tmp, 'ally.config.json'), JSON.stringify({ targetLevel: 'AAA' }));
    const config = loadConfig(tmp);
    expect(config.targetLevel).toBe('AAA');
    expect(config.defaultLang).toBe('en');
  });

  it('throws on invalid config', async () => {
    await writeFile(join(tmp, 'ally.config.json'), JSON.stringify({ targetLevel: 'INVALID' }));
    expect(() => loadConfig(tmp)).toThrow('Invalid ally.config.json');
  });
});
