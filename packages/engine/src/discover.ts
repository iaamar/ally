import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ALWAYS_SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);
const TARGET_EXTENSIONS = new Set(['.tsx', '.jsx', '.html', '.htm']);

function globToRegex(pattern: string): RegExp {
  // Escape regex specials except * and ?
  let re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Handle ** first (before single *)
  re = re.replace(/\*\*/g, '___GLOBSTAR___');
  re = re.replace(/\*/g, '[^/]*');
  re = re.replace(/___GLOBSTAR___/g, '.*');
  re = re.replace(/\?/g, '[^/]');
  return new RegExp(`^${re}$`);
}

export function matchesIgnore(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (globToRegex(pattern).test(relPath)) {
      return true;
    }
  }
  return false;
}

export async function discoverFiles(root: string, ignorePaths: string[]): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(root, fullPath);

      if (entry.isDirectory()) {
        if (ALWAYS_SKIP.has(entry.name)) continue;
        if (matchesIgnore(relPath, ignorePaths)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = '.' + entry.name.split('.').pop()!;
        if (!TARGET_EXTENSIONS.has(ext)) continue;
        if (matchesIgnore(relPath, ignorePaths)) continue;
        results.push(relPath);
      }
    }
  }

  await walk(root);
  return results.sort();
}
