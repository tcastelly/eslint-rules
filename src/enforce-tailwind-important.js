/**
 * @fileoverview Enforce all Tailwind classes to end with "!" (important modifier)
 */
export const isMissingImportant = (cls) => !/^[a-zA-Z0-9-%&>*.:',/[\]()_@]+(:?!)$/.test(cls);

export const addImportant = (cls) => `${cls}!`;

/**
 * Plain (non-Tailwind) classes that must NOT receive the "!" modifier.
 *
 * These ship in the widgets' bundled Bootstrap-style grid CSS and are matched by
 * a bare `.class` selector. Appending "!" turns the token into `class!`, which
 * matches no rule at all (Tailwind does not emit anything for it, and `.class`
 * does not match the `class!` token) - silently breaking the layout.
 */
export const DEFAULT_IGNORED_CLASSES = [
  'row',
  'no-gutters',
  'container',
  'container-fluid',
];

/**
 * Whether a class token must be flagged for a missing "!" modifier.
 * @param {string} cls the class token
 * @param {Set<string>} ignored classes that are allowed without "!"
 */
export const shouldFlag = (cls, ignored) => isMissingImportant(cls) && !ignored.has(cls);

/** Build the set of ignored classes from the rule options. */
export const resolveIgnored = (options) => new Set([
  ...DEFAULT_IGNORED_CLASSES,
  ...((options && options.ignore) || []),
]);

export default {
  meta: {
    type: 'layout',
    docs: { description: 'Enforce Tailwind classes end with "!"', recommended: false },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: { missingImportant: 'Tailwind class "{{cls}}" should end with "!"' },
  },

  create(context) {
    const source = context.getSourceCode();

    const ignored = resolveIgnored(context.options[0]);

    // a class needs the "!" modifier unless it is explicitly ignored
    const isFlagged = (cls) => shouldFlag(cls, ignored);

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    function reportIfMissing(node, value) {
      const classes = value.split(/\s+/).map((cls) => cls.trim()).filter(Boolean);
      const missing = classes.filter(isFlagged);

      // nothing to fix
      if (!missing.length) {
        return;
      }

      const fixed = classes.map((c) => (isFlagged(c) ? addImportant(c) : c)).join(' ');
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
        const fixed = parts.map((p) => (isFlagged(p) ? addImportant(p) : p)).join(' ');
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
          // skip non-string literals, e.g. `cond && 0`
          if (typeof node.value === 'string') {
            reportIfMissing(node, node.value);
          }
          break;
        case 'ArrayExpression':
          node.elements.forEach(processExpression);
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
              .some(isFlagged));

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
        case 'ConditionalExpression':
          processExpression(node.consequent);
          processExpression(node.alternate);
          break;
        case 'LogicalExpression':
          // `cond && 'cls'`: only the right side is a class
          // `cls || 'cls'` / `cls ?? 'cls'`: both sides can be classes
          if (node.operator !== '&&') {
            processExpression(node.left);
          }
          processExpression(node.right);
          break;
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
