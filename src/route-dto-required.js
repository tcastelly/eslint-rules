const getDtoNameFromParam = (param) => {
  const typeAnnotation = param.typeAnnotation?.typeAnnotation;
  if (
    typeAnnotation?.type === 'TSTypeReference'
    && typeAnnotation?.typeName?.name?.endsWith('Dto')
  ) {
    return typeAnnotation.typeName.name;
  }
  return null;
};

const isDtoInRouteDecorator = (decoratorExpr, dtoName) => {
  const args = decoratorExpr.arguments;

  // @route('/path', SomeDtoClass)
  const secondArg = args[1];
  if (secondArg?.type === 'Identifier' && secondArg.name === dtoName) {
    return true;
  }

  // @route({ path: '/path', dto: SomeDtoClass })
  const firstArg = args[0];
  if (firstArg?.type === 'ObjectExpression') {
    return firstArg.properties.some(
      (prop) => prop.key?.name === 'dto' && prop.value?.name === dtoName,
    );
  }

  return false;
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce Dto declaration in @route decorator when a Dto is used as a method parameter',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      missingDto: "Method '{{methodName}}' uses '{{dtoName}}' as a parameter but '{{dtoName}}' is not declared in the @route decorator. Add it as the second argument or as the 'dto' property in the options object.",
    },
  },

  create(context) {
    return {
      MethodDefinition(node) {
        const routeDecorator = node.decorators?.find((decorator) => {
          const expr = decorator.expression;
          return expr.type === 'CallExpression' && expr.callee.name === 'route';
        });

        if (!routeDecorator) return;

        const params = node.value?.params ?? [];

        for (const param of params) {
          const dtoName = getDtoNameFromParam(param);
          if (!dtoName) continue;

          if (!isDtoInRouteDecorator(routeDecorator.expression, dtoName)) {
            context.report({
              node: routeDecorator,
              messageId: 'missingDto',
              data: {
                methodName: node.key?.name ?? 'unknown',
                dtoName,
              },
            });
          }
        }
      },
    };
  },
};
