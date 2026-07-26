export function filterCitedSources<T extends { label: string }>(
  content: string,
  sources: T[] | undefined,
): T[] {
  if (!sources?.length) return [];
  const labels = new Set(
    [...content.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]),
  );
  return sources.filter((source) => labels.has(source.label));
}
