/**
 * @fileoverview require-fragment-key
 *
 * Reports a key-less Fragment (`<>…</>` or `<Fragment>` without `key`) *only* in
 * the positions where Vue's children diff can actually misalign without it:
 *
 *   A. list item          — `list.map(() => <>…</>)`
 *   B. conditional sibling — `{cond && <>…</>}` / `cond ? <>…</> : x`, when the
 *      conditional is one of several children in a JSX element / fragment / array
 *      (the surrounding child list can change shape at runtime).
 *
 * It stays silent where a key is not required:
 *
 *   C. sole return / sole child — `() => <>…</>`, `render() { return <>…</> }`,
 *      `default: () => <>…</>`, `<Parent><>…</></Parent>`
 *   D. static (non-conditional) sibling
 *   E. the Fragment already carries a `key`
 *
 * With `{ strict: true }` (the default) case B fires only when at least one
 * sibling is *also* dynamically rendered (another conditional or a `.map`) —
 * a lone conditional in an otherwise static list cannot drift the diff.
 */

const ITERATOR_METHODS = new Set(['map', 'flatMap']);

const TRANSPARENT_EXPRESSIONS = new Set([
  'JSXExpressionContainer',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
]);

/** A `<>…</>` node, or a `<Fragment>` / `<X.Fragment>` element with no `key`. */
export const isKeylessFragment = (node) => {
  if (!node) return false;
  if (node.type === 'JSXFragment') return true;
  if (node.type !== 'JSXElement') return false;

  const { name } = node.openingElement;
  const local = name.type === 'JSXMemberExpression' ? name.property.name : name.name;
  if (local !== 'Fragment') return false;

  return !node.openingElement.attributes.some(
    (attr) => (attr.type === 'JSXAttribute' && attr.name.name === 'key')
      // a spread might carry a key — don't guess, treat as keyed
      || attr.type === 'JSXSpreadAttribute',
  );
};

const isSignificantChild = (child) => {
  if (child.type === 'JSXText') return child.value.trim() !== '';
  if (child.type === 'JSXExpressionContainer') return child.expression.type !== 'JSXEmptyExpression';
  return true; // JSXElement | JSXFragment | JSXSpreadChild
};

const containsJsx = (node) => {
  if (!node) return false;
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') return true;
  if (node.type === 'ConditionalExpression') {
    return containsJsx(node.consequent) || containsJsx(node.alternate);
  }
  if (node.type === 'LogicalExpression') {
    return containsJsx(node.left) || containsJsx(node.right);
  }
  if (TRANSPARENT_EXPRESSIONS.has(node.type)) return containsJsx(node.expression);
  return false;
};

/** Is this JSX child rendered *dynamically* (a condition or an iterator)? */
const isDynamicChild = (child) => {
  if (child.type !== 'JSXExpressionContainer') return false;

  const expr = child.expression;
  if (expr.type === 'LogicalExpression' || expr.type === 'ConditionalExpression') {
    return containsJsx(expr);
  }
  return (
    expr.type === 'CallExpression'
    && expr.callee.type === 'MemberExpression'
    && expr.callee.property.type === 'Identifier'
    && ITERATOR_METHODS.has(expr.callee.property.name)
  );
};

const isIteratorCallback = (fnNode) => {
  const call = fnNode.parent;
  return (
    call
    && call.type === 'CallExpression'
    && call.arguments[0] === fnNode
    && call.callee.type === 'MemberExpression'
    && call.callee.property.type === 'Identifier'
    && ITERATOR_METHODS.has(call.callee.property.name)
  );
};

/**
 * Walk outward from the fragment through transparent wrappers and conditional
 * operators, and classify the first structural ancestor.
 *
 * @returns {{ kind: string, conditional?: boolean, siblingCount?: number, dynamicSibling?: boolean }}
 */
export const classifyFragment = (fragment) => {
  let cur = fragment;
  let node = fragment.parent;
  let conditional = false;

  while (node) {
    switch (node.type) {
      case 'JSXExpressionContainer':
      case 'ParenthesizedExpression':
      case 'TSAsExpression':
      case 'TSNonNullExpression':
      case 'TSSatisfiesExpression':
      case 'BlockStatement':
      case 'ReturnStatement':
        cur = node;
        node = node.parent;
        break;

      case 'LogicalExpression':
        if (node.right === cur || node.operator === '??') conditional = true;
        cur = node;
        node = node.parent;
        break;

      case 'ConditionalExpression':
        if (node.consequent === cur || node.alternate === cur) conditional = true;
        cur = node;
        node = node.parent;
        break;

      case 'JSXElement':
      case 'JSXFragment': {
        // `cur` is the entry in `node.children` that holds our fragment
        const others = node.children.filter((c) => c !== cur && isSignificantChild(c));
        return {
          kind: 'jsx-child',
          conditional,
          siblingCount: others.length,
          dynamicSibling: others.some(isDynamicChild),
        };
      }

      case 'ArrayExpression': {
        const others = node.elements.filter((el) => el && el !== cur);
        return {
          kind: 'jsx-child',
          conditional,
          siblingCount: others.length,
          dynamicSibling: others.some(containsJsx),
        };
      }

      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
      case 'FunctionDeclaration':
        return { kind: isIteratorCallback(node) ? 'map-callback' : 'return' };

      default:
        return { kind: 'other' };
    }
  }
  return { kind: 'other' };
};

/**
 * @returns {'listItem' | 'conditionalSibling' | null}
 */
export const analyzeFragment = (node, { strict = true } = {}) => {
  if (!isKeylessFragment(node)) return null;

  const {
    kind,
    conditional = false,
    siblingCount = 0,
    dynamicSibling = false,
  } = classifyFragment(node);

  if (kind === 'map-callback') return 'listItem';

  if (
    kind === 'jsx-child'
    && conditional
    && siblingCount >= 1
    && (!strict || dynamicSibling)
  ) {
    return 'conditionalSibling';
  }

  return null;
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a `key` on a Fragment only when it is a list item or a conditional sibling '
        + "(positions where Vue's un-keyed children diff can misalign).",
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: { strict: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      listItem:
        'This Fragment is a list item (`.map`). Give it a keyed root: `<Fragment key={…}>…</Fragment>`.',
      conditionalSibling:
        'This conditional Fragment shares a child list with other dynamic siblings. '
        + 'Vue diffs those children by position — give it `<Fragment key="…">…</Fragment>` '
        + '(a stable literal is enough).',
    },
  },

  create(context) {
    const options = context.options[0] || {};

    const check = (node) => {
      const messageId = analyzeFragment(node, options);
      if (messageId) context.report({ node, messageId });
    };

    return {
      JSXFragment: check,
      JSXElement: check,
    };
  },
};
