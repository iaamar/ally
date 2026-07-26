import { describe, expect, it } from 'vitest';
import { filterCitedSources } from '@/lib/chat-sources';

const sources = [
  { label: 'S1', title: 'Non-text Content' },
  { label: 'S2', title: 'Label in Name' },
  { label: 'S3', title: 'Captions' },
];

describe('filterCitedSources', () => {
  it('shows only evidence cited by the assistant answer', () => {
    expect(
      filterCitedSources('Requirement [S1]. Related detail [S3].', sources),
    ).toEqual([sources[0], sources[2]]);
  });

  it('does not show unrelated retrieval results', () => {
    expect(filterCitedSources('No citation was used.', sources)).toEqual([]);
  });
});
