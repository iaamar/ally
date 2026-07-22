import { describe, it, expect } from 'vitest';
import { fingerprintOf, clusterKeyOf } from '../src/fingerprint.js';
import type { Elem } from '../src/types.js';

function makeElem(overrides: Partial<Elem> & { tag: string; lang: Elem['lang'] }): Elem {
  return {
    attrs: {},
    loc: { file: 'test.tsx', startLine: 1, startCol: 1, endLine: 1, endCol: 10 },
    children: [],
    hasTextContent: false,
    raw: '',
    parent: undefined,
    ...overrides,
  };
}

describe('fingerprintOf', () => {
  it('produces a 16-char lowercase hex string', () => {
    const fp = fingerprintOf('img-alt', 'src/App.tsx', 'src/App.tsx#Hero', '<img src="a">');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — same inputs produce same output', () => {
    const a = fingerprintOf('img-alt', 'src/App.tsx', 'src/App.tsx#Hero', '<img src="a">');
    const b = fingerprintOf('img-alt', 'src/App.tsx', 'src/App.tsx#Hero', '<img src="a">');
    expect(a).toBe(b);
  });

  it('normalises whitespace so extra spaces do not change fingerprint', () => {
    const a = fingerprintOf('img-alt', 'f.tsx', 'f.tsx#X', '<img  src="a">');
    const b = fingerprintOf('img-alt', 'f.tsx', 'f.tsx#X', '<img src="a">');
    expect(a).toBe(b);
  });

  it('different file produces a different fingerprint', () => {
    const a = fingerprintOf('img-alt', 'a.tsx', 'a.tsx#X', '<img>');
    const b = fingerprintOf('img-alt', 'b.tsx', 'b.tsx#X', '<img>');
    expect(a).not.toBe(b);
  });

  it('truncates snippet to 200 chars before hashing', () => {
    const long = 'x'.repeat(300);
    const a = fingerprintOf('r', 'f', 'k', long);
    const b = fingerprintOf('r', 'f', 'k', 'x'.repeat(200));
    expect(a).toBe(b);
  });
});

describe('clusterKeyOf', () => {
  it('jsx with enclosingComponent: relFile#component', () => {
    const elem = makeElem({ tag: 'img', lang: 'jsx', enclosingComponent: 'Hero' });
    expect(clusterKeyOf(elem, 'src/App.tsx')).toBe('src/App.tsx#Hero');
  });

  it('jsx without enclosingComponent: falls back to tag', () => {
    const elem = makeElem({ tag: 'img', lang: 'jsx' });
    expect(clusterKeyOf(elem, 'src/App.tsx')).toBe('src/App.tsx#img');
  });

  it('html with class: relFile#tag.firstClass', () => {
    const elem = makeElem({
      tag: 'div',
      lang: 'html',
      attrs: { class: { value: 'card hero', isExpression: false, loc: { file: 't.html', startLine: 1, startCol: 1, endLine: 1, endCol: 10 } } },
    });
    expect(clusterKeyOf(elem, 'index.html')).toBe('index.html#div.card');
  });

  it('html without class: relFile#tag', () => {
    const elem = makeElem({ tag: 'img', lang: 'html' });
    expect(clusterKeyOf(elem, 'page.html')).toBe('page.html#img');
  });
});
