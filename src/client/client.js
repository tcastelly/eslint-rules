import pluginConfig from '../plugin.js'

export default {
  plugins: {
    tcy: {
      rules: pluginConfig
    },
  },
  rules: {
    // apply `tcy` rules
    'tcy/import-specifiers-per-line': ['error', { maxSpecifiers: 4 }],
    'tcy/export-specifiers-per-line': 'error',
    'tcy/array-elements-per-line': 'error',
    'tcy/jsx-expression-string-literals': 'error',
    'tcy/enforce-tailwind-important': 'error',
    'tcy/v-model-name-match': 'error',
    'tcy/vuejs-define-component': 'error',
    'tcy/vuejs-define-workspace': 'error',
  }
}
