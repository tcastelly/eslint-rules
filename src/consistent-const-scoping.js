/**
 * @fileoverview consistent-const-scoping
 *
 * Reports a `const` declared inside a function when its initializer does not
 * depend on anything from that function (or any function nesting it) — no
 * parameter, no local variable, no `this` / `super` / `arguments`:
 *
 *   function makeGreeter() {
 *     const hello = () => console.log('hello'); // ✗ recreated every call
 *     return { hello };
 *   }
 *
 *   // ✓
 *   const hello = () => console.log('hello');
 *   function makeGreeter() {
 *     return { hello };
 *   }
 *
 * A value with no runtime input to the function is identical on every call,
 * so declaring it inside the function just rebuilds the same thing each
 * time for no benefit and buries a module-level concern inside call-time
 * code.
 *
 * Only a *pure* initializer is flagged — a literal, a template literal /
 * array / object built from pure values, or a function / arrow expression.
 * A `CallExpression`, `NewExpression`, `await`, `yield`, tagged template, or
 * any other expression that can run a side effect or produce a different
 * result depending on *when* it runs is deliberately left alone: unlike a
 * function definition (which does not execute until called), moving one of
 * those changes it from running once per call to running once at module
 * load — that is a behavior change, not just a relocation, and this rule
 * never suggests it.
 *
 * It stays silent when:
 *
 *   - the `const` is already at module scope — nothing to hoist past
 *   - the id is a destructuring pattern (`const { a } = …`) — out of scope
 *     for this rule
 *   - the initializer reads a parameter, an outer local, `this`, `super`,
 *     or `arguments` — moving it would change what it reads
 *   - the initializer is not provably side-effect-free (see above)
 *
 * Which *shape* of initializer gets flagged is configurable via the `types`
 * option, so different parts of a codebase can opt into different strictness
 * levels (e.g. only arrow functions in most folders, arrow functions +
 * primitives in a folder that wants to be stricter):
 *
 *   'consistent-const-scoping': ['error', { types: ['arrow-function', 'primitive'] }]
 *
 * Recognized values: 'primitive', 'template-literal', 'expression' (identifier /
 * unary / binary / logical / conditional / member access), 'array', 'object',
 * 'arrow-function', 'function-expression'. Defaults to `['arrow-function']`.
 */

const LITERAL_TYPES = new Set([
  'Literal', // espree: string / number / boolean / null / regex
  'StringLiteral', // @babel/parser
  'NumericLiteral',
  'BooleanLiteral',
  'BigIntLiteral',
  'NullLiteral',
  'RegExpLiteral',
]);

const UNWRAP_TYPES = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
]);

const FUNCTION_TYPES = new Set(['FunctionExpression', 'ArrowFunctionExpression']);

/** All initializer categories the `types` option can select. */
export const ALL_INIT_TYPES = [
  'primitive',
  'template-literal',
  'expression',
  'array',
  'object',
  'arrow-function',
  'function-expression',
];

export const DEFAULT_INIT_TYPES = ['arrow-function'];

const CATEGORY_BY_TYPE = {
  ArrowFunctionExpression: 'arrow-function',
  FunctionExpression: 'function-expression',
  ArrayExpression: 'array',
  ObjectExpression: 'object',
  TemplateLiteral: 'template-literal',
};

const unwrap = (node) => (node && UNWRAP_TYPES.has(node.type) ? unwrap(node.expression) : node);

/**
 * Which `types` category a (already known-pure) initializer belongs to, after
 * unwrapping the same `as` / `!` / `satisfies` / parens wrappers the purity
 * check sees through. `null` for a node that isn't a recognized initializer
 * shape at all.
 */
export const classifyInit = (node) => {
  const inner = unwrap(node);
  if (!inner) return null;
  if (LITERAL_TYPES.has(inner.type)) return 'primitive';
  if (CATEGORY_BY_TYPE[inner.type]) return CATEGORY_BY_TYPE[inner.type];
  if (
    inner.type === 'Identifier'
    || inner.type === 'UnaryExpression'
    || inner.type === 'BinaryExpression'
    || inner.type === 'LogicalExpression'
    || inner.type === 'ConditionalExpression'
    || inner.type === 'MemberExpression'
    || inner.type === 'OptionalMemberExpression'
  ) return 'expression';
  return null;
};

/** Build the set of enabled initializer categories from the rule options. */
export const resolveInitTypes = (options) => new Set((options && options.types) || DEFAULT_INIT_TYPES);

/** A value that evaluates the same way, with no side effects, wherever it runs. */
export const isPureExpression = (node) => {
  if (!node) return false;
  if (node.type === 'ThisExpression' || node.type === 'Super') return false;
  if (LITERAL_TYPES.has(node.type)) return true;
  if (UNWRAP_TYPES.has(node.type)) return isPureExpression(node.expression);
  if (FUNCTION_TYPES.has(node.type)) return true;
  if (node.type === 'Identifier') return true;
  if (node.type === 'TemplateLiteral') return node.expressions.every(isPureExpression);

  if (node.type === 'UnaryExpression') {
    return node.operator !== 'delete' && isPureExpression(node.argument);
  }
  if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
    return isPureExpression(node.left) && isPureExpression(node.right);
  }
  if (node.type === 'ConditionalExpression') {
    return isPureExpression(node.test)
      && isPureExpression(node.consequent)
      && isPureExpression(node.alternate);
  }
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    return isPureExpression(node.object) && (!node.computed || isPureExpression(node.property));
  }
  if (node.type === 'ArrayExpression') {
    return node.elements.every((el) => {
      if (el === null) return true;
      if (el.type === 'SpreadElement') return isPureExpression(el.argument);
      return isPureExpression(el);
    });
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.every((prop) => {
      if (prop.type === 'SpreadElement') return isPureExpression(prop.argument);
      if (prop.computed && !isPureExpression(prop.key)) return false;
      return isPureExpression(prop.value);
    });
  }

  return false;
};

/** Types that bind their own `this` — a `this` / `super` past this point belongs to them, not the const's init. */
const THIS_BOUNDARY_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
]);

/** Does `node` contain a `this` / `super` that would resolve outside of it (through arrow boundaries only)? */
export const containsBlockingThis = (node) => {
  if (!node || typeof node.type !== 'string') return false;
  if (node.type === 'ThisExpression' || node.type === 'Super') return true;
  if (THIS_BOUNDARY_TYPES.has(node.type)) return false;

  return Object.keys(node).some((key) => {
    if (key === 'parent') return false;
    const value = node[key];
    if (Array.isArray(value)) {
      return value.some((child) => child && typeof child.type === 'string' && containsBlockingThis(child));
    }
    return !!value && typeof value.type === 'string' && containsBlockingThis(value);
  });
};

const describeFunction = (fnNode) => {
  if (fnNode.id?.name) return fnNode.id.name;
  const { parent } = fnNode;
  if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
  if (parent?.type === 'Property' && parent.key.type === 'Identifier') return parent.key.name;
  return '(anonymous function)';
};

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow a `const` inside a function when its (side-effect-free) value does not '
        + 'depend on that function\'s parameters, locals, `this`, or `arguments` — declare it '
        + 'outside so it is not rebuilt on every call.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          types: {
            type: 'array',
            items: { enum: ALL_INIT_TYPES },
            uniqueItems: true,
            default: DEFAULT_INIT_TYPES,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hoistable:
        '`{{name}}` does not depend on anything from `{{fnName}}`\'s scope — declare it '
        + 'outside the function so it is not rebuilt on every call.',
    },
  },

  create(context) {
    const { sourceCode } = context;
    const enabledTypes = resolveInitTypes(context.options[0]);

    /** Every scope from `node` up to (excluding) module/global scope, or `null` if none is a function. */
    const blockingChain = (node) => {
      const chain = [];
      let scope = sourceCode.getScope(node);
      let hasFunctionAncestor = false;

      while (scope && scope.type !== 'global' && scope.type !== 'module') {
        chain.push(scope);
        if (scope.type === 'function') hasFunctionAncestor = true;
        scope = scope.upper;
      }

      return hasFunctionAncestor ? chain : null;
    };

    const isReferencedIn = (chain, range) => chain.some((scope) => scope.variables.some(
      (variable) => variable.references.some(
        (ref) => ref.identifier.range[0] >= range[0] && ref.identifier.range[1] <= range[1],
      ),
    ));

    const nearestFunctionScope = (chain) => chain.find((scope) => scope.type === 'function');

    return {
      VariableDeclarator(node) {
        if (node.parent.type !== 'VariableDeclaration' || node.parent.kind !== 'const') return;
        if (node.id.type !== 'Identifier' || !node.init) return;

        const chain = blockingChain(node);
        if (!chain) return; // already at module scope

        if (!isPureExpression(node.init)) return;
        if (containsBlockingThis(node.init)) return;
        if (isReferencedIn(chain, node.init.range)) return;
        if (!enabledTypes.has(classifyInit(node.init))) return;

        const fnScope = nearestFunctionScope(chain);

        context.report({
          node,
          messageId: 'hoistable',
          data: {
            name: node.id.name,
            fnName: describeFunction(fnScope.block),
          },
        });
      },
    };
  },
};
