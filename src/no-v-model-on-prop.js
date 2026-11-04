// Disallow `v-model` bound to a component prop in a render function:
//
//   export type Foo = Context<typeof setup, Props>;
//   export default function (c: Foo) {
//     return <Input v-model={c.value} />;   // `value` is in `Props`
//   }
//
// Props are readonly: the update is dropped (with a Vue warning). For a nested field (`c.row.recTp`)
// Vue doesn't complain, but the object belongs to the parent component.
//
// `Props` is read from the second type argument of `Context`. A prop and a setup value can't share
// a name, so being a key of `Props` is enough to know `c.x` is a prop.

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow `v-model` bound to a component prop (`c.x` where `x` is in `Props`).',
    },
    messages: {
      prop: '`{{attr}}` is bound to the prop "{{name}}". Props are readonly, emit an update event instead.',
      nestedProp: '`{{attr}}` mutates the prop "{{name}}" ({{expr}}), which belongs to the parent component.',
    },
    schema: [{
      type: 'object',
      properties: {
        // allow `v-model={c.row.field}` when `row` is a prop
        allowNested: { type: 'boolean' },
        // name of the context type, `Context<typeof setup, Props>`
        contextTypeName: { type: 'string' },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const services = context.sourceCode.parserServices;

    // type information is required
    if (!services?.program) {
      return {};
    }

    const { allowNested = false, contextTypeName = 'Context' } = context.options[0] || {};
    const checker = services.program.getTypeChecker();

    // cache by type: the same `c` is used by every v-model of a render function
    const propsCache = new Map();
    const getProps = (identifier) => {
      const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(identifier));
      if (!propsCache.has(type)) {
        propsCache.set(type, getPropsType(checker, type, contextTypeName));
      }
      return propsCache.get(type);
    };

    return {
      JSXAttribute(node) {
        const attr = getVModelAttrName(node);
        if (!attr) return;

        const target = getModelTarget(node.value?.expression);
        if (!target) return;

        if (target.nested && allowNested) return;

        const propsType = getProps(target.object);
        if (!propsType || !checker.getPropertyOfType(propsType, target.name)) return;

        context.report({
          node: node.value,
          messageId: target.nested ? 'nestedProp' : 'prop',
          data: {
            attr,
            name: target.name,
            expr: context.sourceCode.getText(node.value.expression),
          },
        });
      },
    };
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────

/** `v-model` / `v-model:selected` → attribute name, otherwise null */
export const getVModelAttrName = (attr) => {
  if (attr.name.type === 'JSXIdentifier') {
    return attr.name.name === 'v-model' ? 'v-model' : null;
  }
  if (attr.name.type === 'JSXNamespacedName' && attr.name.namespace.name === 'v-model') {
    return `v-model:${attr.name.name.name}`;
  }
  return null;
};

const getStaticPropertyName = (member) => {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') {
    return member.property.value;
  }
  // babel AST (tests)
  if (member.computed && member.property.type === 'StringLiteral') return member.property.value;
  return null;
};

/**
 * Root member of the v-model expression:
 *   c.value        → { object: c, name: 'value', nested: false }
 *   c.row.recTp    → { object: c, name: 'row', nested: true }
 *   value / foo()  → null
 */
export const getModelTarget = (expr) => {
  let e = expr;
  // `c.value!` / `c.value as T`
  while (e && ['TSNonNullExpression', 'TSAsExpression'].includes(e.type)) e = e.expression;

  if (e?.type !== 'MemberExpression') return null;

  let root = e;
  while (root.object.type === 'MemberExpression') root = root.object;

  if (root.object.type !== 'Identifier') return null;

  const name = getStaticPropertyName(root);
  if (!name) return null;

  return {
    object: root.object,
    name,
    nested: root !== e,
  };
};

/**
 * `Props` from a `Context<typeof setup, Props>` type, either used directly
 * or through an alias (`type Foo = Context<typeof setup, Props>`)
 */
export const getPropsType = (checker, type, contextTypeName) => {
  const alias = type.aliasSymbol;
  if (!alias) return null;

  if (alias.name === contextTypeName) {
    return type.aliasTypeArguments?.[1] ?? null;
  }

  for (const decl of alias.declarations ?? []) {
    const ref = decl.type;
    const refName = ref?.typeName?.escapedText ?? ref?.typeName?.right?.escapedText;
    if (refName === contextTypeName && ref.typeArguments?.length >= 2) {
      return checker.getTypeFromTypeNode(ref.typeArguments[1]);
    }
  }

  return null;
};
