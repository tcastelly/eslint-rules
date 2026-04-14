import pluginConfig from './plugin.js'

export default {
  ...pluginConfig,
  rules: {
    'tcy/import-specifiers-per-line': ['error', { maxSpecifiers: 4 }],
    'tcy/export-specifiers-per-line': 'error',
    'tcy/array-elements-per-line': 'error',
  }
}
