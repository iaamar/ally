import { describe, expect, it } from 'vitest';
import { needsKnowledgeSearch } from '@/lib/chat-intent';

describe('needsKnowledgeSearch', () => {
  it('routes greetings directly to the model', () => {
    expect(needsKnowledgeSearch('hi', false)).toBe(false);
    expect(needsKnowledgeSearch('How are you?', true)).toBe(false);
  });

  it('searches for criteria and accessibility questions', () => {
    expect(needsKnowledgeSearch('Explain 1.1.1', false)).toBe(true);
    expect(needsKnowledgeSearch('How should keyboard focus work?', false)).toBe(true);
  });

  it('uses the attached finding for substantive follow-ups', () => {
    expect(needsKnowledgeSearch('Show me the safest fix', true)).toBe(true);
  });
});
