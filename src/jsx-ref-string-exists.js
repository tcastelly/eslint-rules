export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure string refs in TSX (ref="name") exist as properties on the render function\'s first parameter type.',
    },
    messages: {
      missingRef: 'Ref "{{ref}}" does not exist on type "{{types}}".',
      noServices:
        'ref-string-exists requires TypeScript type information. ' +
        'Set parserOptions.projectService (or project) in your ESLint config.',
    },
    schema: [],
  },

  create(context) {
    const services = context.sourceCode.parserServices;

    if (!services?.program) {
      return {
        JSXAttribute(node) {
          if (isStringRef(node)) {
            context.report({ node, messageId: 'noServices' });
          }
        },
      };
    }

    const checker = services.program.getTypeChecker();

    return {
      JSXAttribute(node) {
        if (!isStringRef(node)) return;

        const refName = node.value.value;

        // Collect ALL enclosing functions, nearest first
        const fns = getAllEnclosingFunctions(node);
        if (!fns.length) return;

        // Check each function's first param — pass if ANY of them has the ref
        const checkedTypes = [];
        for (const fn of fns) {
          if (!fn.params?.length) continue;

          const tsNode = services.esTreeNodeToTSNodeMap.get(fn.params[0]);
          const type = checker.getTypeAtLocation(tsNode);
          const prop = checker.getPropertyOfType(type, refName);

          if (prop) return; // ✅ found in at least one scope

          checkedTypes.push(checker.typeToString(type));
        }

        // None of the enclosing functions had it
        context.report({
          node,
          messageId: 'missingRef',
          data: {
            ref: refName,
            types: checkedTypes.join(' | '),
          },
        });
      },
    };
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────

function isStringRef(node) {
  return (
    node.name?.type === 'JSXIdentifier' &&
    node.name.name === 'ref' &&
    node.value?.type === 'Literal' &&
    typeof node.value.value === 'string'
  );
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

function getAllEnclosingFunctions(node) {
  const fns = [];
  let current = node.parent;
  while (current) {
    if (FUNCTION_TYPES.has(current.type)) fns.push(current);
    current = current.parent;
  }
  return fns;
}
