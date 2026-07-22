import type { SourceLocation, TextEdit } from '@ally/shared';
import type { Elem } from '../types.js';

/* ── Attribute helpers ── */

export function hasAttr(e: Elem, name: string): boolean {
  return name in e.attrs;
}

export function attrValue(e: Elem, name: string): string | null {
  const a = e.attrs[name];
  if (!a) return null;
  if (a.isExpression) return null;
  return a.value;
}

export function hasAnyAttr(e: Elem, names: string[]): boolean {
  return names.some((n) => hasAttr(e, n));
}

/* ── Focusability ── */

const NATIVELY_FOCUSABLE_TAGS: Record<string, (e: Elem) => boolean> = {
  a: (e) => hasAttr(e, 'href'),
  button: () => true,
  input: (e) => attrValue(e, 'type') !== 'hidden',
  select: () => true,
  textarea: () => true,
};

export function isNativelyFocusable(e: Elem): boolean {
  const checker = NATIVELY_FOCUSABLE_TAGS[e.tag];
  if (checker && checker(e)) return true;
  // tabindex present and >= 0
  const ti = attrValue(e, 'tabindex');
  if (ti !== null) {
    const n = parseInt(ti, 10);
    if (!isNaN(n) && n >= 0) return true;
  }
  return false;
}

/* ── ARIA constants ── */

export const INTERACTIVE_ROLES: readonly string[] = [
  'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem',
  'option', 'switch', 'textbox', 'combobox', 'slider',
] as const;

export const ARIA_ROLES: readonly string[] = [
  'alert', 'alertdialog', 'application', 'article', 'banner',
  'blockquote', 'button', 'caption', 'cell', 'checkbox',
  'code', 'columnheader', 'combobox', 'command', 'comment',
  'complementary', 'composite', 'contentinfo', 'definition',
  'deletion', 'dialog', 'directory', 'document', 'emphasis',
  'feed', 'figure', 'form', 'generic', 'grid', 'gridcell',
  'group', 'heading', 'img', 'input', 'insertion', 'landmark',
  'link', 'list', 'listbox', 'listitem', 'log', 'main',
  'marquee', 'math', 'meter', 'menu', 'menubar', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'navigation', 'none',
  'note', 'option', 'paragraph', 'presentation', 'progressbar',
  'radio', 'radiogroup', 'range', 'region', 'roletype', 'row',
  'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox',
  'section', 'sectionhead', 'select', 'separator', 'slider',
  'spinbutton', 'status', 'strong', 'structure', 'subscript',
  'suggestion', 'superscript', 'switch', 'tab', 'table',
  'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer',
  'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem', 'widget',
  'window',
] as const;

export const ARIA_PROPS: readonly string[] = [
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete',
  'aria-braillelabel', 'aria-brailleroledescription', 'aria-busy',
  'aria-checked', 'aria-colcount', 'aria-colindex', 'aria-colindextext',
  'aria-colspan', 'aria-controls', 'aria-current', 'aria-describedby',
  'aria-description', 'aria-details', 'aria-disabled', 'aria-dropeffect',
  'aria-errormessage', 'aria-expanded', 'aria-flowto', 'aria-grabbed',
  'aria-haspopup', 'aria-hidden', 'aria-invalid', 'aria-keyshortcuts',
  'aria-label', 'aria-labelledby', 'aria-level', 'aria-live',
  'aria-modal', 'aria-multiline', 'aria-multiselectable', 'aria-orientation',
  'aria-owns', 'aria-placeholder', 'aria-posinset', 'aria-pressed',
  'aria-readonly', 'aria-relevant', 'aria-required', 'aria-roledescription',
  'aria-rowcount', 'aria-rowindex', 'aria-rowindextext', 'aria-rowspan',
  'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax',
  'aria-valuemin', 'aria-valuenow', 'aria-valuetext',
] as const;

/* ── Edit helpers ── */

/**
 * Returns the SourceLocation of the start tag (the opening `<tag ... >` or `<tag ... />`).
 * For simplicity, this returns the element's own loc (which for self-closing or
 * void elements IS the start tag).
 */
export function startTagEditRange(e: Elem): SourceLocation {
  return { ...e.loc };
}

/**
 * Inserts ` ${text}` immediately before the closing `>` or `/>` of the start tag.
 */
export function insertAttrEdit(e: Elem, text: string): TextEdit {
  const raw = e.raw;
  // Find the position of the closing > or />
  const selfCloseMatch = raw.match(/(\/\s*>)\s*$/);
  const closeMatch = raw.match(/(>)/);

  let insertOffset: number;
  if (selfCloseMatch && selfCloseMatch.index !== undefined) {
    insertOffset = selfCloseMatch.index;
  } else if (closeMatch && closeMatch.index !== undefined) {
    insertOffset = closeMatch.index;
  } else {
    insertOffset = raw.length;
  }

  // Convert offset in raw to line/col
  const { line, col } = offsetToLineCol(raw, insertOffset, e.loc.startLine, e.loc.startCol);

  return {
    file: e.loc.file,
    startLine: line,
    startCol: col,
    endLine: line,
    endCol: col,
    replacement: ` ${text}`,
  };
}

/**
 * Removes an attribute from the element by replacing its source range with empty string.
 */
export function removeAttrEdit(e: Elem, attrName: string): TextEdit {
  const attr = e.attrs[attrName];
  if (!attr) {
    throw new Error(`Attribute "${attrName}" not found on <${e.tag}>`);
  }

  // For JSX, attr.loc gives us the attribute location
  // We need to also remove any leading whitespace
  return {
    file: attr.loc.file,
    startLine: attr.loc.startLine,
    startCol: attr.loc.startCol,
    endLine: attr.loc.endLine,
    endCol: attr.loc.endCol,
    replacement: '',
  };
}

/**
 * Replaces the value of an attribute (keeping the attr name, changing only the value).
 */
export function replaceAttrValueEdit(e: Elem, attrName: string, newValue: string): TextEdit {
  const attr = e.attrs[attrName];
  if (!attr) {
    throw new Error(`Attribute "${attrName}" not found on <${e.tag}>`);
  }

  // We replace the entire attr loc range with name="newValue"
  const quote = e.lang === 'jsx' ? '"' : '"';
  return {
    file: attr.loc.file,
    startLine: attr.loc.startLine,
    startCol: attr.loc.startCol,
    endLine: attr.loc.endLine,
    endCol: attr.loc.endCol,
    replacement: `${attrName}=${quote}${newValue}${quote}`,
  };
}

/* ── Internal ── */

function offsetToLineCol(
  raw: string,
  offset: number,
  baseLine: number,
  baseCol: number,
): { line: number; col: number } {
  let line = baseLine;
  let col = baseCol;
  for (let i = 0; i < offset; i++) {
    if (raw[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}
