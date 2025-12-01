/**
 * @fileoverview Enforce all Tailwind classes to end with "!" (important modifier)
 */
export const isMissingImportant = (cls) => !/^[a-zA-Z0-9-%&>*.:',/[\]()_]+(:?!)$/.test(cls);

export const addImportant = (cls) => `${cls}!`;

export default {
  meta: {
    type: 'layout',
    docs: { description: 'Enforce Tailwind classes end with "!"', recommended: false },
    fixable: 'code',
    schema: [],
    messages: { missingImportant: 'Tailwind class "{{cls}}" should end with "!"' },
  },

  create(context) {
    const source = context.getSourceCode();

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    function reportIfMissing(node, value) {
      const classes = value.split(/\s+/).map((cls) => cls.trim()).filter(Boolean);
      const missing = classes.filter(isMissingImportant);

      // nothing to fix
      if (!missing.length) {
        return;
      }

      const fixed = classes.map((c) => (isMissingImportant(c) ? addImportant(c) : c)).join(' ');
      context.report({
        node,
        messageId: 'missingImportant',
        data: { cls: missing.join(' ') },
        fix(fixer) {
          const text = source.getText(node);
          const quote = text[0] || '"';

          return fixer.replaceText(node, `${quote}${fixed}${quote}`);
        },
      });
    }

    function buildFixedTemplateText(templateLiteral) {
      const exprTexts = templateLiteral.expressions.map((e) => source.getText(e));
      const { quasis } = templateLiteral;

      let out = '`';
      for (let i = 0; i < quasis.length; i += 1) {
        // fix literal part
        const parts = quasis[i].value.raw.split(/\s+/).filter(Boolean);
        const fixed = parts.map((p) => (isMissingImportant(p) ? addImportant(p) : p)).join(' ');
        out += fixed;

        // add space before expression if needed
        if (i < exprTexts.length) {
          if (fixed && !fixed.endsWith(' ')) out += ' ';
          out += `\${${exprTexts[i]}}`;
        }
      }
      out += '`';
      return out;
    }

    function processExpression(node) {
      if (!node) {
        return;
      }

      switch (node.type) {
        case 'Literal':
          reportIfMissing(node, node.value);
          break;
        case 'ArrayExpression':
          node.elements.forEach((el) => {
            if (!el) {
              return;
            }

            if (el.type === 'Literal') {
              reportIfMissing(el, el.value);
            } else if (el.type === 'ObjectExpression') {
              el.properties.forEach((p) => {
                if (p.key?.type === 'Literal' && typeof p.key.value === 'string') {
                  reportIfMissing(p.key, p.key.value);
                }
              });
            }
          });
          break;
        case 'ObjectExpression':
          node.properties.forEach((p) => {
            if (p.key?.type === 'Literal' && typeof p.key.value === 'string') {
              reportIfMissing(p.key, p.key.value);
            }
          });
          break;
        case 'TemplateLiteral': {
          const hasMissing = node.quasis
            .some((q) => q.value.raw
              .split(/\s+/)
              .filter(Boolean)
              .some(isMissingImportant));

          if (!hasMissing) {
            return;
          }

          context.report({
            node,
            messageId: 'missingImportant',
            fix(fixer) {
              const newTemplate = buildFixedTemplateText(node);

              return fixer.replaceText(node, newTemplate);
            },
          });
          break;
        }
        default:
          break;
      }
    }

    //----------------------------------------------------------------------
    // Main visitor
    //----------------------------------------------------------------------
    return {
      JSXAttribute(node) {
        if (!node.name) return;
        if (!['class', 'className'].includes(node.name.name)) return;

        const { value } = node;
        if (!value) return;

        if (value.type === 'Literal' && typeof value.value === 'string') {
          reportIfMissing(value, value.value);
        } else if (value.type === 'JSXExpressionContainer') {
          processExpression(value.expression);
        }
      },

      // also handle variables like const diffPosClass = 'text-green-700';
      VariableDeclarator(node) {
        if (
          node.id
          && node.id.type === 'Identifier'
          && /cls|class/i.test(node.id.name) // only match variables with 'class' or 'cls'
          && node.init
          && node.init.type === 'Literal'
          && typeof node.init.value === 'string'
        ) {
          reportIfMissing(node.init, node.init.value);
        }
      },
    };
  },
};
