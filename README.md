# ESLint Custom Rules Documentation

This document provides detailed information about all custom ESLint rules included in this package.

The plugin ships two bundles — `tcy@eslint-rules/back` and `tcy@eslint-rules/client` — each enabling a different subset of rules by default (see [Usage](#usage)). Both bundles register the *full* rule set under `plugins.tcy.rules`, so any rule can still be turned on manually even if its bundle doesn't enable it by default.

## Rules Overview

### Shared rules (enabled by both `back` and `client`)

| Rule Name | Type | Description |
|-----------|------|-------------|
| `import-specifiers-per-line` | Layout | Enforce one import specifier per line when there are more than 4 specifiers |
| `export-specifiers-per-line` | Layout | Enforce one export specifier per line when there are more than 4 specifiers |
| `array-elements-per-line` | Layout | Enforce one array element per line when the array is multiline |
| `consistent-const-scoping` | Suggestion | Disallow a `const` inside a function when its value does not depend on that function's scope |

### Backend-only rules (`tcy@eslint-rules/back`)

| Rule Name | Type | Description |
|-----------|------|-------------|
| `route-dto-required` | Problem | Enforce Dto declaration in `@route` decorator when a Dto is used as a method parameter |

### Client-only rules (`tcy@eslint-rules/client`)

| Rule Name | Type | Description |
|-----------|------|-------------|
| `jsx-expression-string-literals` | Suggestion | Enforce string literals instead of string expressions in JSX |
| `jsx-boolean-shorthand` | Suggestion | Enforce shorthand boolean syntax in JSX props |
| `jsx-ref-string-exists` | Problem | Ensure a string ref (`ref="name"`) exists on the render function's first parameter type |
| `enforce-tailwind-important` | Layout | Enforce Tailwind classes end with the `!` important modifier |
| `v-model-name-match` | Suggestion | Enforce v-model name matching variable names |
| `vuejs-define-component` | Layout | Enforce use of `defineComponent` for Vue components |
| `vuejs-define-workspace` | Problem | Require a `route` property in `defineComponent` for `Workspace*` / `Page*` files |
| `require-fragment-key` | Problem | Require a `key` on a Fragment only where an un-keyed children diff can misalign |
| `no-static-key-in-map` | Problem | Disallow a static `key` on the root element returned from `.map()` / `.flatMap()` |

### Other rules (registered, but not enabled by either bundle by default)

| Rule Name | Type | Description |
|-----------|------|-------------|
| `decorator-type-enforcement` | Problem | Enforce a property's type based on its `@boolean` / `@dbIntBoolean` decorator |

> `decorator-type-enforcement` is exported by the plugin but isn't listed in either `src/back/back.js` or `src/client/client.js` — turn it on explicitly (see [Usage](#usage)) if you want it.

## Rule Details

### Shared rules

#### 1. import-specifiers-per-line

**Type:** Layout

**Description:** Enforces one import specifier per line when there are more than 4 specifiers.

**Options:**
- `maxSpecifiers` (number, default: 4) - Maximum number of specifiers before enforcing line separation
- `maxLen` (number, optional) - Maximum line length before enforcing line separation

**Examples:**

Valid:
```javascript
import { a } from 'module';
import { a, b } from 'module';
import {
  a,
  b,
  c,
  d,
} from 'module';
```

Invalid:
```javascript
import { a, b, c, d, e } from 'module';
```

Automatically fixes to:
```javascript
import {
  a,
  b,
  c,
  d,
  e,
} from 'module';
```

#### 2. export-specifiers-per-line

**Type:** Layout

**Description:** Enforces one export specifier per line when there are more than 4 specifiers.

**Examples:**

Valid:
```javascript
export { a };
export { a, b };
export {
  a,
  b,
  c,
  d,
};
```

Invalid:
```javascript
export { a, b, c, d, e };
```

Automatically fixes to:
```javascript
export {
  a,
  b,
  c,
  d,
  e,
};
```

#### 3. array-elements-per-line

**Type:** Layout

**Description:** Enforces one array element per line when the first element is on a new line.

**Examples:**

Valid:
```javascript
const arr = [1, 2, 3];
const arr = [
  1,
  2,
  3,
];
```

Invalid:
```javascript
const arr = [
  1, 2, 3,
];
```

Automatically fixes to:
```javascript
const arr = [
  1,
  2,
  3,
];
```

#### 4. consistent-const-scoping

**Type:** Suggestion

**Description:** Disallows a `const` declared inside a function when its (side-effect-free) initializer does not depend on that function's parameters, locals, `this`, `super`, or `arguments` — such a value is rebuilt identically on every call, so it should be declared outside the function instead.

**Options:**
- `types` (array, default: `['arrow-function']`) - which shapes of initializer to flag: `'primitive'`, `'template-literal'`, `'expression'` (identifier / unary / binary / logical / conditional / member access), `'array'`, `'object'`, `'arrow-function'`, `'function-expression'`

**Examples:**

Valid:
```javascript
const hello = () => console.log('hello');
function makeGreeter() {
  return { hello };
}

function makeGreeter(name) {
  // depends on a param — stays put
  const hello = () => console.log(`hello ${name}`);
  return { hello };
}
```

Invalid:
```javascript
function makeGreeter() {
  const hello = () => console.log('hello'); // recreated every call
  return { hello };
}
```

### Backend-only rules

#### 1. route-dto-required

**Type:** Problem

**Description:** Enforces that a Dto used as a method parameter is also declared in that method's `@route` decorator, either as the second argument or as the `dto` property of the options object.

**Examples:**

Valid:
```typescript
class UserController {
  @route('/users', CreateUserDto)
  create(body: CreateUserDto) {}

  @route({ path: '/users', dto: CreateUserDto })
  update(body: CreateUserDto) {}
}
```

Invalid:
```typescript
class UserController {
  @route('/users')
  create(body: CreateUserDto) {}
}
```

### Client-only rules

#### 1. jsx-expression-string-literals

**Type:** Suggestion

**Description:** Enforces string literals instead of string expressions in JSX.

**Examples:**

Valid:
```javascript
<Component title="hello" />
<Component title={someVariable} />
```

Invalid:
```javascript
<Component title={'hello'} />
```

Automatically fixes to:
```javascript
<Component title="hello" />
```

#### 2. jsx-boolean-shorthand

**Type:** Suggestion

**Description:** Enforces shorthand boolean syntax in JSX props.

**Examples:**

Valid:
```javascript
<Component disabled />
<Component disabled={false} />
<Component disabled={someCondition} />
```

Invalid:
```javascript
<Component disabled={true} />
```

Automatically fixes to:
```javascript
<Component disabled />
```

#### 3. jsx-ref-string-exists

**Type:** Problem

**Description:** Ensures string refs in TSX (`ref="name"`) exist as properties on the render function's first parameter type. Requires type information — set `parserOptions.projectService` (or `project`) in your ESLint config, otherwise every string ref is flagged with a `noServices` warning instead.

**Examples:**

Valid:
```tsx
function MyComponent(props: { myRef: unknown }) {
  return <div ref="myRef" />;
}
```

Invalid:
```tsx
function MyComponent(props: { other: unknown }) {
  return <div ref="myRef" />;
}
```

#### 4. enforce-tailwind-important

**Type:** Layout

**Description:** Enforces every Tailwind utility class to end with the `!` important modifier (e.g. `text-red-500!`) — this is Tailwind's own suffix syntax, not CSS's `!important`. Each whitespace-separated class token is checked independently. Checks JSX `class`/`className` attributes — plain string literals as well as expressions built from them (arrays, object keys, template literals, conditional/logical expressions) — and `const xxxClass`/`xxxCls = '...'` variable declarations.

**Options:**
- `ignore` (array, optional) - extra class names that are allowed to stay without the `!` modifier, on top of the defaults (`row`, `no-gutters`, `container`, `container-fluid` — non-Tailwind, Bootstrap-style grid classes that would silently stop matching any CSS rule if suffixed).

**Examples:**

Valid:
```jsx
<div className="text-red-500! p-4!" />
<div className={cond ? 'text-red-500!' : 'text-blue-500!'} />
const cardCls = 'rounded-lg! shadow!';
```

With `{ ignore: ['my-legacy-class'] }`:
```jsx
<div className="my-legacy-class text-red-500!" />
```

Invalid:
```jsx
<div className="text-red-500 p-4" />
const cardCls = 'rounded-lg shadow';
```

Automatically fixes to:
```jsx
<div className="text-red-500! p-4!" />
const cardCls = 'rounded-lg! shadow!';
```

#### 5. v-model-name-match

**Type:** Suggestion

**Description:** Enforces v-model name matching variable names.

**Examples:**

Valid:
```javascript
<input v-model="value" />
<input v-model="formData.value" />
```

Invalid:
```javascript
<input v-model="value" />
```

#### 6. vuejs-define-component

**Type:** Layout

**Description:** Enforces use of `defineComponent` for Vue components.

**Examples:**

Valid:
```javascript
export default defineComponent({});
export default {
  name: 'MyComponent',
};
```

Invalid:
```javascript
export default {
  name: 'MyComponent',
};
```

Automatically fixes to:
```javascript
export default defineComponent({
  name: 'MyComponent',
});
```

#### 7. vuejs-define-workspace

**Type:** Problem

**Description:** Requires a `route` property in the `defineComponent({ ... })` object exported by default from any file whose basename starts with `Workspace` or `Page` (e.g. `WorkspaceSettings.vue.ts`, `PageHome.tsx`). Files that don't match that naming pattern are not checked at all. There is no autofix — the rule can't infer what the route path should be.

**Examples:**

Valid (`WorkspaceSettings.vue.ts`):
```javascript
export default defineComponent({
  route: { path: '/settings' },
  name: 'WorkspaceSettings',
});
```

Invalid (`WorkspaceSettings.vue.ts`):
```javascript
export default defineComponent({
  name: 'WorkspaceSettings',
});
```

Not checked at all (filename doesn't start with `Workspace`/`Page`):
```javascript
// Settings.vue.ts
export default defineComponent({
  name: 'Settings',
});
```

#### 8. require-fragment-key

**Type:** Problem

**Description:** Requires a `key` on a Fragment (`<>…</>` or `<Fragment>`) only in the positions where an un-keyed children diff can actually misalign at runtime: a list item (`.map`/`.flatMap`) or a conditional sibling sharing a child list with another dynamically-rendered sibling. Stays silent for a sole return/child or a static sibling, where no key is needed.

**Options:**
- `strict` (boolean, default: `true`) - when `true`, a conditional sibling only requires a key if at least one other sibling in the same list is also dynamically rendered (another conditional or a `.map`)

**Examples:**

Valid:
```jsx
// sole return — no key needed
const Comp = () => <>{children}</>;

// already keyed
list.map((item) => <Fragment key={item.id}>{item.label}</Fragment>);
```

Invalid:
```jsx
list.map((item) => <>{item.label}</>);

<div>
  {cond && <>{a}</>}
  {otherCond && <span>{b}</span>}
</div>
```

#### 9. no-static-key-in-map

**Type:** Problem

**Description:** Disallows a static `key` (a string / number / boolean literal, or a template literal with no interpolation) on the root element returned from a `.map()` / `.flatMap()` callback — every iteration would render the same key, so the list is diffed by position instead of identity.

**Examples:**

Valid:
```jsx
list.map((item) => <Row key={item.id} />);
list.map((item, i) => <Row key={i} />);
```

Invalid:
```jsx
list.map((item) => <Row key="row" />);
list.map(() => <Fragment key="rows">…</Fragment>);
```

### Other rules

#### 1. decorator-type-enforcement

**Type:** Problem

**Description:** Enforces a decorated class property's TypeScript type based on which decorator it carries:
- `@boolean` — the property's type must be exactly `boolean` (auto-fixed by replacing the type).
- `@dbIntBoolean` — the property's type must be (or include, in a union) `number` or `boolean` — modeling a DB column stored as an int-backed boolean.

> **Note:** in the current implementation, the `@dbIntBoolean` autofix always rewrites the type to `boolean`, even though the reported message says the type "must be of type `number`" — this looks like a leftover bug in the rule rather than intended behavior. Flagging it here rather than silently documenting it as correct; happy to fix the rule if you want.

**Examples:**

Valid:
```typescript
class Entity {
  @boolean
  isActive: boolean;

  @dbIntBoolean
  isEnabled: number;

  @dbIntBoolean
  isEnabled: number | boolean;
}
```

Invalid:
```typescript
class Entity {
  @boolean
  isActive: string;

  @dbIntBoolean
  isEnabled: string;
}
```

Automatically fixes `@boolean` mismatches to:
```typescript
class Entity {
  @boolean
  isActive: boolean;
}
```

## Usage

### Backend

```javascript
import backCustomRules from 'tcy@eslint-rules/back';

const backConfig = [
  backCustomRules,
  {
    files: ['**/*.+(ts|tsx|mts|cts)'],
    rules: {
      // `types`: which initializer shapes to flag; defaults to `['arrow-function']`.
      'tcy/consistent-const-scoping': ['error', { types: ['arrow-function', 'primitive'] }],
      // registered by the plugin but not enabled by `back` — opt in explicitly:
      'tcy/decorator-type-enforcement': 'error',
    },
  },
];

export default [
  ...backConfig,
];
```

### Client

```javascript
import clientCustomRules from 'tcy@eslint-rules/client';

const clientConfig = [
  clientCustomRules,
  {
    files: ['**/*.+(ts|tsx|mts|cts)'],
    rules: {
      // `ignore`: extra class names that may stay without the `!` modifier
      // (non-Tailwind classes such as Bootstrap-style grid helpers).
      // `row`, `no-gutters`, `container`, `container-fluid` are ignored by default.
      'tcy/enforce-tailwind-important': ['error', { ignore: ['my-legacy-class'] }],
      // `strict: false` also flags a lone conditional sibling with no other dynamic sibling.
      'tcy/require-fragment-key': ['error', { strict: true }],
      // `types`: which initializer shapes to flag; defaults to `['arrow-function']`.
      'tcy/consistent-const-scoping': ['error', { types: ['arrow-function', 'primitive'] }],
      // `jsx-ref-string-exists` requires `parserOptions.projectService` (or `project`)
      // for type information to be set elsewhere in this config.
    },
  },
];

export default [
  ...clientConfig,
];
```
