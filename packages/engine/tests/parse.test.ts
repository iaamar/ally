import { describe, expect, it } from 'vitest';
import { parseSource } from '../src/parse.js';

const TSX = `
export function Card({ src }: { src: string }) {
  return (
    <div className="card" onClick={() => open()}>
      <img src={src} />
      <a href="/docs">Docs</a>
    </div>
  );
}`;

describe('parseSource jsx', () => {
  const doc = parseSource('src/Card.tsx', TSX);
  it('extracts intrinsic elements in order with tags lowercased', () => {
    expect(doc.elements.map(e => e.tag)).toEqual(['div', 'img', 'a']);
  });
  it('normalizes attribute names and flags expressions', () => {
    const [div, img, a] = doc.elements;
    expect(div.attrs['class']).toMatchObject({ value: 'card', isExpression: false });
    expect(div.attrs['onClick'].isExpression).toBe(true);
    expect(img.attrs['src']).toMatchObject({ value: null, isExpression: true });
    expect(a.attrs['href'].value).toBe('/docs');
  });
  it('records component context, parents, text content', () => {
    const [div, img, a] = doc.elements;
    expect(div.enclosingComponent).toBe('Card');
    expect(img.parent?.tag).toBe('div');
    expect(a.hasTextContent).toBe(true);
    expect(img.hasTextContent).toBe(false);
  });
  it('captures 1-based locations and raw snippet', () => {
    const img = doc.elements[1];
    expect(img.loc.startLine).toBe(5);
    expect(img.raw).toBe('<img src={src} />');
  });
});

describe('parseSource html', () => {
  const doc = parseSource('index.html',
    `<html><head><title>Hi</title></head><body><img src="x.png" alt="x"><button class="cta">Go</button></body></html>`);
  it('extracts elements with attrs', () => {
    const img = doc.elements.find(e => e.tag === 'img')!;
    expect(img.attrs['alt'].value).toBe('x');
    expect(img.lang).toBe('html');
  });
  it('tracks text content and parent chain', () => {
    const button = doc.elements.find(e => e.tag === 'button')!;
    expect(button.hasTextContent).toBe(true);
    expect(button.parent?.tag).toBe('body');
  });
});
