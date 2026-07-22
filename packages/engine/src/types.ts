import type { SourceLocation } from '@ally/shared';

export interface Attr {
  value: string | null;
  isExpression: boolean;
  loc: SourceLocation;
}

export interface Elem {
  tag: string;
  attrs: Record<string, Attr>;
  loc: SourceLocation;
  parent?: Elem;
  children: Elem[];
  hasTextContent: boolean;
  enclosingComponent?: string;
  lang: 'jsx' | 'html';
  raw: string;
}

export interface ParsedDoc {
  file: string;
  lang: 'jsx' | 'html';
  elements: Elem[];
  source: string;
}

export interface AllyConfig {
  targetLevel: 'A' | 'AA' | 'AAA';
  ignoreRules: string[];
  ignorePaths: string[];
  defaultLang: string;
  autofix: 'on' | 'off';
  appUrl?: string;
  projectName?: string;
}
