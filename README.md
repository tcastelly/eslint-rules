# Custom rules 

```typescript
import clientCustomRules from 'tcy@eslint-rules/client';

const customConfig = [
  clientCustomRules,
  {
    files: ['**/*.+(ts|tsx|mts|cts)'],
    rules: {
      'tcy/import-specifiers-per-line': ['error', { maxSpecifiers: 4 }],
      'tcy/export-specifiers-per-line': 'error',
      'tcy/array-elements-per-line': 'error',
    },
  },
];

export default [
  ...customConfig,
];
```
