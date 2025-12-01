export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce one export specifier per line with trailing comma',
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const { specifiers } = node;
        if (!specifiers || specifiers.length <= 1) return;

        const sourceCode = context.getSourceCode();

        // Check if each specifier is already on its own line and last has comma
        let needsFix = false;
        for (let i = 1; i < specifiers.length; i += 1) {
          if (specifiers[i].loc.start.line === specifiers[i - 1].loc.start.line) {
            needsFix = true;
            break;
          }
        }

        needsFix = needsFix || !!sourceCode
          .getText(node, { comments: false })
          .slice(specifiers[0].range[0]).match(/, [a-zA-Z0-9_]/);

        if (!needsFix) {
          return;
        }

        const last = specifiers[specifiers.length - 1];
        const afterLastChar = sourceCode.getText().slice(last.range[1], last.range[1] + 1);

        const needsComma = afterLastChar !== ',';

        // Generate fixed text without adding extra braces
        const exportText = specifiers
          .map((s) => sourceCode.getText(s))
          .join(',\n  ');

        const fixedText = needsComma ? `${exportText},` : exportText;

        // Replace only the inner part of the braces
        const first = specifiers[0].range[0];
        const lastRange = specifiers[specifiers.length - 1].range[1];

        context.report({
          node,
          message: 'Each export specifier must be on its own line with trailing comma.',
          fix(fixer) {
            const r = fixer.replaceTextRange([first, lastRange], fixedText);

            return r;
          },
        });
      },
    };
  },
};
