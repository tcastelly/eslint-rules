export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce shorthand boolean syntax in JSX props',
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        // Only check boolean values in JSX
        if (node.value && node.value.type === 'JSXExpressionContainer') {
          const expression = node.value.expression;

          // Check if the value is a boolean literal 'true'
          if (expression.type === 'Literal' && expression.value === true) {
            context.report({
              node,
              message: 'Use shorthand boolean syntax instead of {{value}}',
              data: {
                value: node.value.raw || node.value.expression.raw,
              },
              fix(fixer) {
                // Remove the expression container and just keep the attribute name
                return fixer.replaceText(node, node.name.name);
              },
            });
          }
        }
      },
    };
  },
};