import { createHash } from 'node:crypto';
import type { Elem } from './types.js';

/**
 * Compute a stable 16-char hex fingerprint for a finding.
 *
 * Formula: sha256(`${ruleId}|${relFile}|${clusterKey}|${normSnippet}`).hex.slice(0,16)
 * where normSnippet = snippet.replace(/\s+/g, ' ').trim().slice(0, 200)
 */
export function fingerprintOf(
  ruleId: string,
  relFile: string,
  clusterKey: string,
  snippet: string,
  ordinal: number = 0,
): string {
  const normSnippet = snippet.replace(/\s+/g, ' ').trim().slice(0, 200);
  const input = `${ruleId}|${relFile}|${clusterKey}|${ordinal}|${normSnippet}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export function matchKeyOf(
  ruleId: string,
  relFile: string,
  clusterKey: string,
): string {
  return createHash('sha256')
    .update(`${ruleId}|${relFile}|${clusterKey}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Compute the cluster key for an element.
 *
 * JSX: `${relFile}#${enclosingComponent ?? tag}`
 * HTML: `${relFile}#${tag}${firstClass ? '.' + firstClass : ''}`
 */
export function clusterKeyOf(elem: Elem, relFile: string): string {
  if (elem.lang === 'jsx') {
    return `${relFile}#${elem.enclosingComponent ?? elem.tag}`;
  }
  // html
  const classAttr = elem.attrs['class'];
  const firstClass = classAttr?.value?.split(/\s+/)[0] ?? '';
  return `${relFile}#${elem.tag}${firstClass ? '.' + firstClass : ''}`;
}
