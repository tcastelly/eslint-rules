export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce one array element per line when the array is multiline',
      category: 'Stylistic Issues',
      recommended: false,
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      ArrayExpression(node) {
        if (node.elements.length <= 1) {
          return;
        }

        const sourceCode = context.getSourceCode();
        const first = node.elements[0];
        if (!first) return;

        const arrayStartLine = node.loc.start.line;
        const firstLine = first.loc.start.line;

        // Only apply if first element is NOT on same line as '['
        if (firstLine === arrayStartLine) {
          return;
        }

        // Check if already formatted correctly
        let alreadyCorrect = true;
        for (let i = 1; i < node.elements.length; i += 1) {
          const prev = node.elements[i - 1];
          const curr = node.elements[i];
          if (prev && curr && prev.loc.start.line === curr.loc.start.line) {
            alreadyCorrect = false;
            break;
          }
        }
        if (alreadyCorrect) return;

        context.report({
          node,
          message: `Each array element must be on its own 
line when first element is on a new line.`,
          fix(fixer) {
            const elementsText = node.elements.map((el) => {
              if (!el) return '';
              let text = sourceCode.getText(el).trim();
              if (!text.endsWith(',')) text += ',';
              return `  ${text}`;
            }).join('\n');

            return fixer.replaceText(node, `[\n${elementsText}\n]`);
          },
        });
      },
    };
  },
};
