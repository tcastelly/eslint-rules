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
      // `ignore`: extra class names that may stay without the `!` modifier
      // (non-Tailwind classes such as Bootstrap-style grid helpers).
      // `row`, `no-gutters`, `container`, `container-fluid` are ignored by default.
      'tcy/enforce-tailwind-important': ['error', { ignore: ['my-legacy-class'] }],
    },
  },
];

export default [
  ...customConfig,
];
```
