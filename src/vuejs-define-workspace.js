import path from 'node:path';

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a route object in defineComponent for Workspace* and Page* files',
      recommended: false,
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();
    const basename = path.basename(filename);

    const requiresRoute =
      basename.startsWith('Workspace') || basename.startsWith('Page');

    // If filename doesn't match, do nothing
    if (!requiresRoute) {
      return {};
    }

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

        const hasRoute = arg.properties.some(
          (prop) =>
            prop.type === 'Property' &&
            !prop.computed &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'route'
        );

        if (!hasRoute) {
          context.report({
            node: arg,
            message:
              'Components in Workspace* or Page* files must define a "route" object',
          });
        }
      },
    };
  },
};
