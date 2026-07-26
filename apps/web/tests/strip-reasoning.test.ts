import { describe, expect, it } from 'vitest';
import { createReasoningStripper } from '@/lib/strip-reasoning';

describe('createReasoningStripper', () => {
  it('removes reasoning while preserving the answer', () => {
    const stripper = createReasoningStripper();
    const output = [
      stripper.push('<think>internal plan</think>The safe fix is '),
      stripper.push('to add `alt` text.'),
      stripper.flush(),
    ].join('');

    expect(output).toBe('The safe fix is to add `alt` text.');
  });

  it('handles tags split across stream chunks', () => {
    const stripper = createReasoningStripper();
    const output = [
      stripper.push('<thi'),
      stripper.push('nk>hidden</thi'),
      stripper.push('nk>Answer only.'),
      stripper.flush(),
    ].join('');

    expect(output).toBe('Answer only.');
  });
});
