export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure v-model property name matches name attribute when v-model uses an object property',
      recommended: false,
    },
    schema: [],
    messages: {
      mismatch:
        '`v-model` property "{{model}}" does not match name="{{name}}"',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        let modelProp = null;
        let isObjectProperty = false;
        let nameProp = null;

        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          if (!attr.value) continue;
          if (attr.name.type !== 'JSXIdentifier') continue;

          // v-model={c.details.price}
          if (
            attr.name.name === 'v-model' &&
            attr.value.type === 'JSXExpressionContainer'
          ) {
            const expr = attr.value.expression;

            // Must be a MemberExpression whose object is ALSO a MemberExpression
            // i.e. c.details.price (not c.price)
            if (
              expr?.type === 'MemberExpression' &&
              expr.property.type === 'Identifier' &&
              expr.object?.type === 'MemberExpression'
            ) {
              isObjectProperty = true;
              modelProp = expr.property.name;
            }
          }

          // name="price"
          if (
            attr.name.name === 'name' &&
            attr.value.type === 'Literal' &&
            typeof attr.value.value === 'string'
          ) {
            nameProp = attr.value.value;
          }
        }

        // Only enforce if v-model is object.property.property
        if (!isObjectProperty) return;

        if (modelProp && nameProp && modelProp !== nameProp) {
          context.report({
            node,
            messageId: 'mismatch',
            data: {
              model: modelProp,
              name: nameProp,
            },
          });
        }
      },
    };
  },
};
