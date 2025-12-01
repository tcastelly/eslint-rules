# Custom rules 

```typescript
import { plugin as customRules } from 'tcy@eslint-rules/src/index.mjs';

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
    }
  }
];


export default [
  ...customConfig,
];
```
