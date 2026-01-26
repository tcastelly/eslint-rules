export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce property type based on decorator',
      category: 'Stylistic Issues',
      recommended: false,
    },
    fixable: 'code',
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      PropertyDefinition(node) {
        if (!node.decorators || !node.typeAnnotation) {
          return;
        }

        for (const decorator of node.decorators) {
          const expr = decorator.expression;

          if (expr.name === 'boolean') {
            const typeNode = node.typeAnnotation.typeAnnotation;

            // Only autofix simple, explicit types
            if (typeNode.type === 'TSBooleanKeyword') {
              return;
            }

            context.report({
              node: typeNode,
              message: 'Property decorated with @boolean must be of type "boolean"',
              fix(fixer) {
                return fixer.replaceText(typeNode, 'boolean');
              },
            });
          }

          if (expr.name === 'dbIntBoolean') {
            const typeNode = node.typeAnnotation.typeAnnotation;

            // Only autofix simple, explicit types
            if (typeNode.type === 'TSNumberKeyword') {
              return;
            }

            context.report({
              node: typeNode,
              message: 'Property decorated with @dbIntBoolean must be of type "number"',
              fix(fixer) {
                return fixer.replaceText(typeNode, 'number');
              },
            });
          }

          continue;
        }
      },
    };
  },
};
