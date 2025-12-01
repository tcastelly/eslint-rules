# Custom rules 

```typescript
import customRules from 'tcy@eslint-rules';

const customConfig = [
  {
    files: ['**/*.+(ts|tsx|mts|cts)'],
    plugins: {
      'custom-rules': customRules,
    },
    rules: {
      'custom-rules/import-specifiers-per-line': ['error', { maxSpecifiers: 4 }],
      'custom-rules/export-specifiers-per-line': 'error',
      'custom-rules/array-elements-per-line': 'error',
    },
  },
];

export default [
  ...customConfig,
];
```
