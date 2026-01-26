import importSpecifiersPerLineRule from './import-specifiers-per-line.js';
import arrayElementsPerLineRule from './array-elements-per-line.js';
import exportSpecifiersPerLineRule from './export-specifiers-per-line.js';
import jsxExpressionStringLiterals from './jsx-expression-string-literals.js';
import enforceTailwindImportant from './enforce-tailwind-important.js';
import vModelNameMatch from './v-model-name-match.js';
import decoratorTypeEnforcement from './decorator-type-enforcement.js'

export default {
  rules: {
    'import-specifiers-per-line': importSpecifiersPerLineRule,
    'array-elements-per-line': arrayElementsPerLineRule,
    'export-specifiers-per-line': exportSpecifiersPerLineRule,
    'jsx-expression-string-literals': jsxExpressionStringLiterals,
    'enforce-tailwind-important': enforceTailwindImportant,
    'v-model-name-match': vModelNameMatch,
    'decorator-type-enforcement': decoratorTypeEnforcement,
  },
};
