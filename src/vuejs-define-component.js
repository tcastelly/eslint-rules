const attributesOrder = [
  'name',
  'route',
  'inheritAttrs',
  'directives',
  'props',
  'emits',
  'render',
  'setup',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Custom best practices in defineComponent',
      recommended: false,
    },
    schema: [],
  },

  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;

        // export default defineComponent(...)
        if (
          !decl ||
          decl.type !== 'CallExpression' ||
          decl.callee.type !== 'Identifier' ||
          decl.callee.name !== 'defineComponent'
        ) {
          return;
        }

        const arg = decl.arguments[0];

        // defineComponent({ ... })
        if (!arg || arg.type !== 'ObjectExpression') {
          return;
        }


        const seenIndexes = [];

        arg.properties.forEach((prop) => {
          if (prop.type !== 'Property' || prop.computed) return;
          if (prop.key.type !== 'Identifier') return;

          const index = attributesOrder.indexOf(prop.key.name);
          if (index !== -1) {
            seenIndexes.push({
              name: prop.key.name,
              index,
              node: prop,
            });
          }
        });

        // ---- name required ----
        if (!seenIndexes.some((p) => p.name === 'name')) {
          context.report({
            node: arg,
            message: 'Components defined with defineComponent must have a "name" property',
          });
          return;
        }

        // ---- order validation ----
        for (let i = 1; i < seenIndexes.length; i++) {
          const prev = seenIndexes[i - 1];
          const curr = seenIndexes[i];

          if (curr.index < prev.index) {
            context.report({
              node: curr.node,
              message: `"${curr.name}" should appear before "${prev.name}" in defineComponent options`,
            });
            return;
          }
        }
      },
    };
  },
};
