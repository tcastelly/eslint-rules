export default {
  meta: {
    type: 'layout',
    docs: {
      description:
        "Convert JSX expression string literals like id={'test'} to id=\"test\"",
    },
    fixable: 'code',
    schema: [],
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.value) return;

        // Look for: id={ 'test' }
        if (node.value.type !== 'JSXExpressionContainer') return;

        const expr = node.value.expression;

        // Must be a simple string literal
        if (expr.type !== 'Literal' || typeof expr.value !== 'string') return;

        const stringValue = expr.value;

        context.report({
          node: node.value,
          message:
            'String literal attributes should not use expression containers. Use id="{{value}}".',
          data: { value: stringValue },
          fix(fixer) {
            // Directly replace with a normal JSX string literal
            const newText = `"${stringValue.replace(/"/g, '\\"')}"`;
            return fixer.replaceText(node.value, newText);
          },
        });
      },
    };
  },
};
