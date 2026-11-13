// Disallow a key returned by a composition function (`useXxx.ts`) or by the `setup` of `Component.ts`
// that nothing else of the component reads:
//
//   Component.ts       defineComponent + setup, spreads the composables in a single object
//   useComponent.ts    composable          ← the rule runs here, on the returned object
//   Component.ts       the `setup` returned object is checked too
//   useComponent2.ts   other composable
//   useRender.tsx      render, reads the keys through `c.key`
//
// A returned key is used when its name is found in another file of the same directory (or of its
// sub-directories, a child can read it through the context type): the render,
// `Component.ts` or another composable (`useGridConfig(p, { columnFilteredName })`). A key used only
// by a composable is not reported, it can be a value shared between compositions, not rendered.
//
// The check is by name, on purpose: it can miss an unused key sharing its name with something else,
// but never reports a used one. `ref="name"` is a use too.
//
// The directory is skipped when:
//   - it has no `Component.ts` (a file calling `defineComponent`) importing the composable:
//     a composable shared by many components, or used through inject / by a parent
//   - a render file spreads (`...c`), or passes the whole context to a function (`foo(c)`) that
//     can't be resolved (relative import): any key can be read. A resolved function is searched too

import fs from 'node:fs';
import path from 'node:path';

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow a key returned by a composable that is not used by the component (render or other compositions).',
    },
    messages: {
      unused: '"{{name}}" is returned by the setup but not used by the render or by another composition of the component.',
    },
    schema: [{
      type: 'object',
      properties: {
        // keys that are never reported
        ignore: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();

    // `Component.ts` (`setup`) or a composable (`useXxx.ts`, default export)
    const isComposable = isComposableFile(filename);
    if (!isComposable && !isComponentFileName(filename)) return {};

    const { ignore = [] } = context.options[0] || {};

    const siblings = readSiblings(filename);
    if (!siblings) return {};

    // the composable is part of the setup of the component of its directory,
    // otherwise it is shared (inject, parent, ...) and the keys are read from elsewhere
    const base = path.basename(filename).replace(EXT, '');
    if (isComposable) {
      const component = siblings.find((s) => !s.inner && isComponentFile(s));
      if (!component || !new RegExp(`from\\s+['"]\\./${escapeRegExp(base)}['"]`).test(component.text)) return {};
    } else if (!/\bdefineComponent\s*\(/.test(context.sourceCode.text)) {
      return {};
    }
    const isTarget = (fn, names) => (isComposable ? isExported(fn, names) : isSetup(fn));

    const texts = siblings.map((s) => s.text);

    // the render passes its whole context: `...c` hides the keys that are read, `foo(c)` is
    // resolved and the file of `foo` is searched too (not resolvable: every key can be used)
    for (const s of siblings) {
      if (!s.isRender || s.inner) continue;

      const { spread, callees } = getWholeContextUsage(s.text);
      if (spread) return {};

      for (const callee of callees) {
        const imported = readImported(callee, s.text, path.dirname(filename));
        if (imported === null) return {};
        texts.push(imported);
      }
    }

    // function stack, only the exported function counts
    const stack = [];
    const enter = (node) => { stack.push(node); };
    const leave = () => { stack.pop(); };

    const exportedNames = new Set();

    return {
      Program(program) {
        for (const node of program.body) {
          if (node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'Identifier') {
            exportedNames.add(node.declaration.name);
          }
        }
      },

      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': leave,
      FunctionExpression: enter,
      'FunctionExpression:exit': leave,
      ArrowFunctionExpression(node) {
        enter(node);
        // `=> ({ a, b })`
        if (node.body.type === 'ObjectExpression' && isTarget(node, exportedNames)) {
          check(context, node.body, texts, ignore);
        }
      },
      'ArrowFunctionExpression:exit': leave,

      ReturnStatement(node) {
        if (node.argument?.type !== 'ObjectExpression') return;
        const fn = stack[stack.length - 1];
        if (!fn || !isTarget(fn, exportedNames)) return;
        check(context, node.argument, texts, ignore);
      },
    };
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────

const EXT = /\.(ts|tsx|js|jsx)$/;

/** `useXxx.ts`, but not the render function */
export const isComposableFile = (filename) => {
  const base = path.basename(filename);
  return /^use[A-Z].*\.(ts|js)$/.test(base) && !/^useRender\./.test(base) && !/\.(spec|test)\./.test(base);
};

const isComponentFile = (sibling) => !sibling.isComposable && /\bdefineComponent\s*\(/.test(sibling.text);

const cache = new Map();

/** Other files of the directory, `null` if it can't be read */
const readSiblings = (filename) => {
  const dir = path.dirname(filename);
  let names;
  try {
    names = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const result = [];
  walk(dir, filename, 0, result);
  return result;
};

const MAX_DEPTH = 4;

// files of the directory, `inner` the ones of its sub-directories: a child component can read
// the keys through the context type
const walk = (dir, self, depth, result) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const file = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH && entry.name !== 'node_modules') walk(file, self, depth + 1, result);
      continue;
    }

    const { name } = entry;
    if (file === self || !EXT.test(name) || /\.(spec|test)\./.test(name) || /\.d\.ts$/.test(name)) continue;

    try {
      const { mtimeMs } = fs.statSync(file);
      const hit = cache.get(file);
      if (hit?.mtimeMs === mtimeMs) {
        result.push(hit.sibling);
        continue;
      }

      const sibling = {
        name,
        inner: depth > 0,
        isRender: /^useRender\./.test(name),
        isComposable: /^use[A-Z]/.test(name),
        text: stripComments(fs.readFileSync(file, 'utf8')),
      };
      cache.set(file, { mtimeMs, sibling });
      result.push(sibling);
    } catch {
      // unreadable file, ignored
    }
  }
};

export const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `name` found as a whole word in one of the texts */
export const isUsed = (name, texts) => {
  const re = new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`);
  return texts.some((t) => re.test(t));
};

/** Name of the first parameter of the render function, `null` if destructured / not found */
const getContextName = (text) => {
  const m = /(?:function\s*\w*\s*|=\s*)\(\s*(?:\{[^}]*\}|(\w+))\s*(?::[^)]*)?\)/.exec(text);
  return m ? { name: m[1] ?? null, rest: text.slice(m.index + m[0].length) } : null;
};

/**
 * How the render uses its whole context (`c`):
 *   - `{ spread: true }`  `...c`: any key can be read
 *   - `{ callees: [...] }` `foo(a, c)`: the names of the called functions, they read keys of `c`
 */
export const getWholeContextUsage = (text) => {
  const ctx = getContextName(text);
  if (!ctx?.name) return { spread: false, callees: [] };

  const n = escapeRegExp(ctx.name);
  if (new RegExp(`\\.\\.\\.${n}(?![\\w$])`).test(ctx.rest)) return { spread: true, callees: [] };

  const callees = [];
  const call = new RegExp(`([\\w$]+)\\s*\\(([^()]*,\\s*)?${n}\\s*[,)]`, 'g');
  for (const m of ctx.rest.matchAll(call)) callees.push(m[1]);
  // a bare `(c)` / `, c)` not matched above: unknown callee
  const bare = new RegExp(`[(,]\\s*${n}\\s*[,)]`, 'g');
  const unknown = [...ctx.rest.matchAll(bare)].length > callees.length;
  return { spread: unknown, callees };
};

/** `usesWholeContext`: the render hides the keys it reads */
export const usesWholeContext = (text) => {
  const { spread, callees } = getWholeContextUsage(text);
  return spread || callees.length > 0;
};

const RESOLVE_EXT = ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'];

/** Text of the file imported as `name` with a relative path, `null` if not resolvable */
export const readImported = (name, text, dir) => {
  const n = escapeRegExp(name);
  const m = new RegExp(`import\\s+${n}\\s+from\\s+['"](\\.[^'"]*)['"]|import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*['"](\\.[^'"]*)['"]`).exec(text);
  const rel = m && (m[1] ?? m[2]);
  if (!rel) return null;

  for (const ext of RESOLVE_EXT) {
    const file = path.resolve(dir, rel + ext);
    try {
      return stripComments(fs.readFileSync(file, 'utf8'));
    } catch {
      // next candidate
    }
  }
  return null;
};

/** `Component.ts`: not a composable, not the render */
export const isComponentFileName = (filename) => {
  const base = path.basename(filename);
  return /\.(ts|js)$/.test(base) && !/^use[A-Z]/.test(base) && !/\.(spec|test|d)\./.test(base);
};

/** `const setup = () => {}` or `defineComponent({ setup() {}, setup: () => {} })` */
const isSetup = (fn) => {
  const { parent } = fn;
  if (parent?.type === 'VariableDeclarator') return parent.id.type === 'Identifier' && parent.id.name === 'setup';
  if (fn.type === 'FunctionDeclaration') return fn.id?.name === 'setup';
  if (parent?.type === 'Property' || parent?.type === 'MethodDefinition') {
    return !parent.computed && parent.key.type === 'Identifier' && parent.key.name === 'setup';
  }
  return false;
};

const isExported = (fn, exportedNames) => {
  const { parent } = fn;
  if (parent?.type === 'ExportDefaultDeclaration') return true;
  if (fn.type === 'FunctionDeclaration' && fn.id && exportedNames.has(fn.id.name)) return true;
  if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier' && exportedNames.has(parent.id.name)) {
    return true;
  }
  return false;
};

export const getKeyName = (prop) => {
  if (prop.type !== 'Property' || prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
};

const check = (context, objectNode, texts, ignore) => {
  for (const prop of objectNode.properties) {
    const name = getKeyName(prop);
    if (!name || ignore.includes(name)) continue;

    if (!isUsed(name, texts)) {
      context.report({ node: prop, messageId: 'unused', data: { name } });
    }
  }
};
