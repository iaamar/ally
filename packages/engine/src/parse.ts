import { parse as babelParse } from '@babel/parser';
import type {
  JSXElement, FunctionDeclaration, VariableDeclarator,
  Node,
} from '@babel/types';
import type { NodePath, TraverseOptions } from '@babel/traverse';
import * as parse5 from 'parse5';
import { createRequire } from 'node:module';
import type { SourceLocation } from '@ally/shared';
import type { Elem, Attr, ParsedDoc } from './types.js';

const require = createRequire(import.meta.url);

// Dynamic import workaround for @babel/traverse CJS/ESM interop
let _traverseFn: (
  parent: Node,
  opts?: TraverseOptions,
) => void;

// Lazy-init to handle CJS default export interop
function getTraverse(): typeof _traverseFn {
  if (!_traverseFn) {
    const mod = require('@babel/traverse');
    _traverseFn = typeof mod === 'function' ? mod : (mod.default ?? mod);
  }
  return _traverseFn;
}

const ATTR_NAME_MAP: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
};

function normalizeAttrName(name: string): string {
  return ATTR_NAME_MAP[name] ?? name;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

interface JSXChildNode {
  type: string;
  value?: string;
  children?: JSXChildNode[];
}

function checkJSXTextContent(children: JSXChildNode[]): boolean {
  for (const child of children) {
    if (child.type === 'JSXText' && child.value && child.value.trim().length > 0) {
      return true;
    }
    if (child.type === 'JSXExpressionContainer') {
      return true;
    }
    if (child.type === 'JSXElement') {
      if (child.children && checkJSXTextContent(child.children)) {
        return true;
      }
    }
  }
  return false;
}

function parseJSX(file: string, source: string): ParsedDoc {
  const ast = babelParse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const elements: Elem[] = [];
  const nodeToElem = new Map<object, Elem>();

  const traverse = getTraverse();

  traverse(ast, {
    JSXElement(path: NodePath<JSXElement>) {
      const openingEl = path.node.openingElement;
      const nameNode = openingEl.name;

      // Only process intrinsic elements (lowercase JSXIdentifier)
      if (nameNode.type !== 'JSXIdentifier') return;
      const tag = nameNode.name;
      if (tag[0] !== tag[0].toLowerCase() || tag[0] === tag[0].toUpperCase()) return;

      // Build attrs
      const attrs: Record<string, Attr> = {};
      for (const attr of openingEl.attributes) {
        if (attr.type !== 'JSXAttribute') continue;
        const rawName = attr.name.type === 'JSXIdentifier'
          ? attr.name.name
          : `${attr.name.namespace.name}:${attr.name.name.name}`;
        const name = normalizeAttrName(rawName);

        const attrLoc: SourceLocation = {
          file,
          startLine: attr.loc!.start.line,
          startCol: attr.loc!.start.column + 1,
          endLine: attr.loc!.end.line,
          endCol: attr.loc!.end.column + 1,
        };

        if (attr.value === null || attr.value === undefined) {
          attrs[name] = { value: null, isExpression: false, loc: attrLoc };
        } else if (attr.value.type === 'StringLiteral') {
          attrs[name] = { value: attr.value.value, isExpression: false, loc: attrLoc };
        } else if (attr.value.type === 'JSXExpressionContainer') {
          const expr = attr.value.expression;
          if (expr.type === 'StringLiteral') {
            attrs[name] = { value: expr.value, isExpression: false, loc: attrLoc };
          } else if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0 && expr.quasis.length === 1) {
            attrs[name] = { value: expr.quasis[0].value.cooked ?? expr.quasis[0].value.raw, isExpression: false, loc: attrLoc };
          } else {
            attrs[name] = { value: null, isExpression: true, loc: attrLoc };
          }
        }
      }

      // Location
      const loc: SourceLocation = {
        file,
        startLine: path.node.loc!.start.line,
        startCol: path.node.loc!.start.column + 1,
        endLine: path.node.loc!.end.line,
        endCol: path.node.loc!.end.column + 1,
      };

      // Raw snippet
      const raw = truncate(source.slice(path.node.start!, path.node.end!), 300);

      // Determine enclosing component
      let enclosingComponent: string | undefined;
      let current: NodePath<Node> | null = path.parentPath;
      while (current) {
        const node = current.node;
        if (node.type === 'FunctionDeclaration') {
          const funcNode = node as FunctionDeclaration;
          if (funcNode.id?.name && /^[A-Z]/.test(funcNode.id.name)) {
            enclosingComponent = funcNode.id.name;
            break;
          }
        }
        if (node.type === 'VariableDeclarator') {
          const varNode = node as VariableDeclarator;
          if (varNode.id.type === 'Identifier' && /^[A-Z]/.test(varNode.id.name)) {
            enclosingComponent = varNode.id.name;
            break;
          }
        }
        if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
          if (current.parentPath?.node.type === 'VariableDeclarator') {
            const decl = current.parentPath.node as VariableDeclarator;
            if (decl.id.type === 'Identifier' && /^[A-Z]/.test(decl.id.name)) {
              enclosingComponent = decl.id.name;
              break;
            }
          }
        }
        current = current.parentPath;
      }

      // Check hasTextContent
      const hasTextContent = checkJSXTextContent(path.node.children as unknown as JSXChildNode[]);

      // Find parent Elem
      let parentElem: Elem | undefined;
      let parentPath: NodePath<Node> | null = path.parentPath;
      while (parentPath) {
        if (parentPath.node.type === 'JSXElement') {
          parentElem = nodeToElem.get(parentPath.node);
          break;
        }
        parentPath = parentPath.parentPath;
      }

      const elem: Elem = {
        tag,
        attrs,
        loc,
        parent: parentElem,
        children: [],
        hasTextContent,
        enclosingComponent,
        lang: 'jsx',
        raw,
      };

      if (parentElem) {
        parentElem.children.push(elem);
      }

      nodeToElem.set(path.node, elem);
      elements.push(elem);
    },
  } as TraverseOptions);

  return { file, lang: 'jsx', elements, source };
}

interface Parse5Node {
  nodeName: string;
  tagName?: string;
  childNodes?: Parse5Node[];
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  sourceCodeLocation?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    startOffset: number;
    endOffset: number;
    startTag?: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
      startOffset: number;
      endOffset: number;
    };
    endTag?: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
      startOffset: number;
      endOffset: number;
    };
  };
}

function parseHTML(file: string, source: string): ParsedDoc {
  const doc = parse5.parse(source, { sourceCodeLocationInfo: true }) as unknown as Parse5Node;
  const elements: Elem[] = [];

  function walk(node: Parse5Node, parentElem?: Elem): void {
    if (node.tagName && node.sourceCodeLocation) {
      const scl = node.sourceCodeLocation;

      const attrs: Record<string, Attr> = {};
      if (node.attrs) {
        for (const a of node.attrs) {
          const attrLoc: SourceLocation = {
            file,
            startLine: scl.startLine,
            startCol: scl.startCol,
            endLine: scl.endLine,
            endCol: scl.endCol,
          };
          attrs[a.name] = { value: a.value, isExpression: false, loc: attrLoc };
        }
      }

      const loc: SourceLocation = {
        file,
        startLine: scl.startLine,
        startCol: scl.startCol,
        endLine: scl.endLine,
        endCol: scl.endCol,
      };

      const rawEnd = scl.startTag ? scl.startTag.endOffset : scl.endOffset;
      const raw = truncate(source.slice(scl.startOffset, rawEnd), 300);

      const hasTextContent = checkHTMLTextContent(node);

      const elem: Elem = {
        tag: node.tagName,
        attrs,
        loc,
        parent: parentElem,
        children: [],
        hasTextContent,
        lang: 'html',
        raw,
      };

      if (parentElem) {
        parentElem.children.push(elem);
      }

      elements.push(elem);

      if (node.childNodes) {
        for (const child of node.childNodes) {
          walk(child, elem);
        }
      }
    } else {
      if (node.childNodes) {
        for (const child of node.childNodes) {
          walk(child, parentElem);
        }
      }
    }
  }

  walk(doc);
  return { file, lang: 'html', elements, source };
}

function checkHTMLTextContent(node: Parse5Node): boolean {
  if (node.childNodes) {
    for (const child of node.childNodes) {
      if (child.nodeName === '#text' && child.value && child.value.trim().length > 0) {
        return true;
      }
      if (child.tagName && checkHTMLTextContent(child)) {
        return true;
      }
    }
  }
  return false;
}

const JSX_EXTENSIONS = new Set(['.tsx', '.jsx', '.js']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);

export function parseSource(file: string, source: string): ParsedDoc {
  const ext = '.' + file.split('.').pop()!;

  if (JSX_EXTENSIONS.has(ext)) {
    return parseJSX(file, source);
  }

  if (HTML_EXTENSIONS.has(ext)) {
    return parseHTML(file, source);
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}
