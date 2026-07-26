import { afterEach, describe, expect, it } from 'vitest';
import { createState } from '../src/state.js';

const originalRoot = process.env.ALLY_PROJECT_ROOT;
const originalClaudeRoot = process.env.CLAUDE_PROJECT_DIR;

afterEach(() => {
  if (originalRoot === undefined) delete process.env.ALLY_PROJECT_ROOT;
  else process.env.ALLY_PROJECT_ROOT = originalRoot;
  if (originalClaudeRoot === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = originalClaudeRoot;
});

describe('MCP session state', () => {
  it('uses Claude Code project directory as the default scan root', () => {
    delete process.env.ALLY_PROJECT_ROOT;
    process.env.CLAUDE_PROJECT_DIR = '/workspace/customer-app';

    expect(createState().root).toBe('/workspace/customer-app');
  });

  it('allows an explicit Ally project root override', () => {
    process.env.CLAUDE_PROJECT_DIR = '/workspace/customer-app';
    process.env.ALLY_PROJECT_ROOT = '/workspace/override';

    expect(createState().root).toBe('/workspace/override');
  });
});
