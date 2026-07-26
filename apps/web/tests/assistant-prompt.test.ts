import { describe, expect, it } from 'vitest';
import {
  CASUAL_ASSISTANT_PROMPT,
  technicalAssistantPrompt,
} from '@/lib/assistant-prompt';

describe('assistant prompt', () => {
  it('uses a deterministic developer answer structure for scan findings', () => {
    const prompt = technicalAssistantPrompt(true);

    expect(prompt).toContain('## Fix');
    expect(prompt).toContain('## Why it fails');
    expect(prompt).toContain('## Verify');
    expect(prompt).toContain('## WCAG basis');
    expect(prompt).toContain('Never invent an element');
    expect(prompt).toContain('do not fabricate a patch');
    expect(prompt).toContain('under 240 words');
  });

  it('keeps general technical answers flexible and properly formatted', () => {
    const prompt = technicalAssistantPrompt(false);

    expect(prompt).toContain('## Answer');
    expect(prompt).toContain('fenced blocks with a language identifier');
    expect(prompt).toContain('valid GitHub-flavored Markdown');
  });

  it('keeps casual turns short and source-free', () => {
    expect(CASUAL_ASSISTANT_PROMPT).toContain('one or two sentences');
    expect(CASUAL_ASSISTANT_PROMPT).toContain(
      'Do not search for or mention WCAG sources',
    );
  });
});
