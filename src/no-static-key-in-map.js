/**
 * @fileoverview no-static-key-in-map
 *
 * Reports a JSX list item whose `key` is a *static* value (a string / number /
 * boolean literal, or a template literal with no interpolation) when that
 * element is the root returned from an iterator callback:
 *
 *   list.map(() => <Row key="row" />)                 // ✗ same key every item
 *   list.map(() => <Fragment key="rows">…</Fragment>) // ✗
 *   list.map((r) => r.ok && <Row key="row" />)        // ✗ (conditional in .map)
 *   list.flatMap(() => [<A key="a" />, <B key="b" />]) // ✗ (array returned from .map)
 *
 * A constant key on every sibling is worse than no key: Vue / React build a
 * key → index map where later duplicates overwrite earlier ones, so on
 * insert / remove / reorder the diff patches the wrong node (misplaced DOM,
 * lost child-component state) and dev builds warn about duplicate keys.
 *
 * It stays silent when:
 *
 *   - the key is derived from the item or the index — `key={r.id}`, `key={i}`,
 *     `` key={`row-${i}`} ``
 *   - the element is NOT the list-item root — a static key on a nested element
 *     (`<ul>{rows.map(() => <li key="only" />)}</ul>` inside a keyed root) is
 *     scoped to its own parent's children, not the iterated list
 *   - there is no `key` at all — that is `react/jsx-key` / `require-fragment-key`
 */

const ITERATOR_METHODS = new Set(['map', 'flatMap']);

const LITERAL_TYPES = new Set([
  'Literal', // espree: string / number / boolean / null / regex
  'StringLiteral', // @babel/parser
  'NumericLiteral',
  'BooleanLiteral',
  'BigIntLiteral',
  'NullLiteral',
]);

const UNWRAP_TYPES = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
]);

/** Transparent wrappers we walk *through* on the way out to the callback. */
const TRANSPARENT_ANCESTORS = new Set([
  'JSXExpressionContainer',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'BlockStatement',
  'ReturnStatement',
  'ArrayExpression',
  'LogicalExpression',
  'ConditionalExpression',
]);

/** A value with no runtime input — a bare literal or a `${…}`-free template. */
export const isStaticExpression = (node) => {
  if (!node) return false;
  if (LITERAL_TYPES.has(node.type)) return true;
  if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
  if (UNWRAP_TYPES.has(node.type)) return isStaticExpression(node.expression);
  return false;
};

/**
 * The `key` attribute of a JSXElement when it is present *and* static.
 * `<>…</>` can never carry a key, so only JSXElement is inspected
 * (`<Fragment key="…">` included).
 *
 * @returns the `key` JSXAttribute node, or `null`
 */
export const getStaticKeyAttr = (node) => {
  if (!node || node.type !== 'JSXElement') return null;

  const attr = node.openingElement.attributes.find(
    (a) => a.type === 'JSXAttribute'
      && a.name.type === 'JSXIdentifier'
      && a.name.name === 'key',
  );
  if (!attr) return null;

  const { value } = attr;
  // `key` with no value (`<X key />`) — treat as static, it is never dynamic
  if (!value) return attr;
  if (value.type === 'JSXExpressionContainer') {
    return isStaticExpression(value.expression) ? attr : null;
  }
  // a plain JSX string attribute: `key="row"`
  return LITERAL_TYPES.has(value.type) ? attr : null;
};

/** Is `fnNode` the first argument of a `.map()` / `.flatMap()` call? */
export const isIteratorCallback = (fnNode) => {
  const call = fnNode.parent;
  return !!call
    && call.type === 'CallExpression'
    && call.arguments[0] === fnNode
    && call.callee.type === 'MemberExpression'
    && call.callee.property.type === 'Identifier'
    && ITERATOR_METHODS.has(call.callee.property.name);
};

/**
 * Walk outward from `node` through transparent wrappers and conditional
 * operators. `node` is a list-item root when the first structural ancestor
 * reached is an iterator callback; it is NOT when a JSX element / fragment is
 * reached first (the element is nested, its key scoped to that parent).
 */
export const isListItemRoot = (node) => {
  let node_ = node.parent;

  while (node_) {
    if (TRANSPARENT_ANCESTORS.has(node_.type)) {
      node_ = node_.parent;
      continue;
    }
    if (
      node_.type === 'ArrowFunctionExpression'
      || node_.type === 'FunctionExpression'
    ) {
      return isIteratorCallback(node_);
    }
    // JSXElement / JSXFragment / anything else → not a direct list item
    return false;
  }
  return false;
};

/**
 * @returns {'staticKeyInIterator' | null}
 */
export const analyzeElement = (node) => {
  const keyAttr = getStaticKeyAttr(node);
  if (!keyAttr) return null;
  return isListItemRoot(node) ? 'staticKeyInIterator' : null;
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a static `key` (string / number / template-without-interpolation) '
        + 'on the root element returned from `.map()` / `.flatMap()` — every item would '
        + 'get the same key.',
      recommended: false,
    },
    schema: [],
    messages: {
      staticKeyInIterator:
        'Static `key={{keyText}}` on a `.map()` list item — every iteration renders the '
        + 'same key, so Vue diffs the list by position and can mismatch nodes on '
        + 'insert / remove / reorder. Derive it from the item (`key={item.id}`) or, '
        + 'failing that, the index (`key={i}`).',
    },
  },

  create(context) {
    const { sourceCode } = context;

    const check = (node) => {
      const keyAttr = getStaticKeyAttr(node);
      if (!keyAttr || !isListItemRoot(node)) return;

      context.report({
        node: keyAttr,
        messageId: 'staticKeyInIterator',
        data: {
          keyText: keyAttr.value ? sourceCode.getText(keyAttr.value) : '(none)',
        },
      });
    };

    return {
      JSXElement: check,
    };
  },
};
