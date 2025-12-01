export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce one import specifier per line if more than 4 specifiers',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          maxSpecifiers: { type: 'number', default: 4 },
          maxLen: { type: 'number', default: 120 },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {
      maxSpecifiers: 4,
    };

    const { maxSpecifiers, maxLen } = options;

    return {
      ImportDeclaration(node) {
        const sourceCode = context.getSourceCode();

        let importText = sourceCode.getText(node);

        const len = importText.length;

        const specifiers = node.specifiers.filter((s) => s.type === 'ImportSpecifier');

        // ignore <= 4 imports
        let needsFix = specifiers.length >= maxSpecifiers;

        if (!needsFix && !!maxLen && len > maxLen) {
          needsFix = true;
        }

        if (!needsFix || !specifiers.length) {
          return;
        }

        // Check if each specifier is already on its own line
        for (let i = 1; i < specifiers.length; i += 1) {
          if (specifiers[i].loc.start.line === specifiers[i - 1].loc.start.line) {
            needsFix = true;
            break;
          }
        }

        if (!needsFix) {
          return;
        }

        // Check if last specifier has a trailing comma
        const last = specifiers[specifiers.length - 1];
        const afterLastChar = sourceCode.getText().slice(last.range[1], last.range[1] + 1);

        const addComma = afterLastChar !== ',';

        const importLine = node.loc.start.line;
        const lastBracketLine = node.loc.end.line;

        const addFirstBreakLine = importLine === specifiers[0].loc.start.line;
        const addLastBreakLine = lastBracketLine === specifiers[specifiers.length - 1].loc.start.line;

        // Generate fixed text **without adding extra braces**
        importText = specifiers
          .map((s) => sourceCode.getText(s))
          .join(',\n  ');

        const fixedText = (
          `${addFirstBreakLine ? '\n  ' : ''}`
          + `${importText}`
          + `${addComma ? ',' : ''}`
          + `${addLastBreakLine ? '\n ' : ''}`
        );

        // Replace **only the inner part** of the braces
        const first = specifiers[0].range[0];
        const lastRange = specifiers[specifiers.length - 1].range[1];

        if (sourceCode.getText().slice(first, lastRange) === fixedText) {
          return;
        }

        context.report({
          node,
          message: 'Each import specifier must be on its own line when there are more than 4 imports, with trailing comma.',
          fix(fixer) {
            const r = fixer.replaceTextRange([first, lastRange], fixedText);
            return r;
          },
        });
      },
    };
  },
};
