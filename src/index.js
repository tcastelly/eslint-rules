import importSpecifiersPerLineRule from './import-specifiers-per-line.js';
import arrayElementsPerLineRule from './array-elements-per-line.js';
import exportSpecifiersPerLineRule from './export-specifiers-per-line.js';
import jsxExpressionStringLiterals from './jsx-expression-string-literals.js';
import enforceTailwindImportant from './enforce-tailwind-important.js';
import vModelNameMatch from './v-model-name-match.js';
import decoratorTypeEnforcement from './decorator-type-enforcement.js'
import vuejsDefineComponent from './vuejs-define-component.js'
import vuejsDefineWorkspace from './vuejs-define-workspace.js'

export default {
  plugins: {
    tcy: {
      rules: {
        'import-specifiers-per-line': importSpecifiersPerLineRule,
        'array-elements-per-line': arrayElementsPerLineRule,
        'export-specifiers-per-line': exportSpecifiersPerLineRule,
        'jsx-expression-string-literals': jsxExpressionStringLiterals,
        'enforce-tailwind-important': enforceTailwindImportant,
        'v-model-name-match': vModelNameMatch,
        'decorator-type-enforcement': decoratorTypeEnforcement,
        'vuejs-define-component': vuejsDefineComponent,
        'vuejs-define-workspace': vuejsDefineWorkspace,
      }
    }
  },
  rules: {
    'tcy/import-specifiers-per-line': ['error', { maxSpecifiers: 4 }],
    'tcy/export-specifiers-per-line': 'error',
    'tcy/array-elements-per-line': 'error',
    'tcy/jsx-expression-string-literals': 'error',
    'tcy/enforce-tailwind-important': 'error',
    'tcy/v-model-name-match': 'error',
    'tcy/vuejs-define-component': 'error',
    'tcy/vuejs-define-workspace': 'error',
  },
};
