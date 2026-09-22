import { parse } from '@babel/parser';
import {
  classifyInit,
  containsBlockingThis,
  DEFAULT_INIT_TYPES,
  isPureExpression,
  resolveInitTypes,
} from '../src/consistent-const-scoping';

// ─── isPureExpression ───────────────────────────────────────────────────────

describe('GIVEN "consistent-const-scoping" / isPureExpression', () => {
  const expr = (code) => parse(`(${code})`, { plugins: ['typescript'] }).program.body[0].expression;

  it.each([
    ['"hello"', true],
    ['42', true],
    ['/foo/g', true],
    ['`hello`', true],
    ['() => console.log("hi")', true],
    ['function () { return 1; }', true],
    ['{ a: 1, b: [1, 2, "x"] }', true],
    ['[1, 2, 3]', true],
    ['a.b.c', true],
    ['1 + 2', true],
    ['a ? 1 : 2', true],
    ['console.log("hi")', false],
    ['new Date()', false],
    ['Math.random()', false],
    ['`hello ${getName()}`', false],
    ['this.value', false],
    ['[foo()]', false],
    ['{ a: foo() }', false],
  ])('THEN %s → pure:%s', (code, pure) => {
    expect(isPureExpression(expr(code))).toBe(pure);
  });
});

// ─── containsBlockingThis ───────────────────────────────────────────────────

describe('GIVEN "consistent-const-scoping" / containsBlockingThis', () => {
  const expr = (code) => parse(`(${code})`, { plugins: ['typescript'] }).program.body[0].expression;

  it('THEN a bare `this` is blocking', () => {
    expect(containsBlockingThis(expr('this.value'))).toBe(true);
  });

  it('THEN `this` inside an arrow (inherited) is blocking', () => {
    expect(containsBlockingThis(expr('() => this.value'))).toBe(true);
  });

  it('THEN `this` inside a nested function (own binding) is NOT blocking', () => {
    expect(containsBlockingThis(expr('function () { return this.value; }'))).toBe(false);
  });

  it('THEN no `this` at all is not blocking', () => {
    expect(containsBlockingThis(expr('() => 42'))).toBe(false);
  });
});

// ─── classifyInit ───────────────────────────────────────────────────────────

describe('GIVEN "consistent-const-scoping" / classifyInit', () => {
  const expr = (code) => parse(`(${code})`, { plugins: ['typescript'] }).program.body[0].expression;

  it.each([
    ['"hello"', 'primitive'],
    ['42', 'primitive'],
    ['/foo/g', 'primitive'],
    ['`hello`', 'template-literal'],
    ['() => 1', 'arrow-function'],
    ['function () { return 1; }', 'function-expression'],
    ['[1, 2, 3]', 'array'],
    ['{ a: 1 }', 'object'],
    ['a', 'expression'],
    ['a.b.c', 'expression'],
    ['1 + 2', 'expression'],
    ['a ? 1 : 2', 'expression'],
  ])('THEN %s → %s', (code, category) => {
    expect(classifyInit(expr(code))).toBe(category);
  });

  it('THEN it unwraps `as` / `!` / `satisfies` / parens before classifying', () => {
    expect(classifyInit(expr('(() => 1) as unknown'))).toBe('arrow-function');
    expect(classifyInit(expr('(1)!'))).toBe('primitive');
    expect(classifyInit(expr('({ a: 1 } satisfies unknown)'))).toBe('object');
  });
});

// ─── resolveInitTypes ───────────────────────────────────────────────────────

describe('GIVEN "consistent-const-scoping" / resolveInitTypes', () => {
  it('THEN it defaults to arrow-function only', () => {
    expect(resolveInitTypes()).toEqual(new Set(DEFAULT_INIT_TYPES));
    expect(resolveInitTypes(undefined)).toEqual(new Set(['arrow-function']));
  });

  it('THEN an explicit "types" option overrides the default', () => {
    expect(resolveInitTypes({ types: ['arrow-function', 'primitive'] }))
      .toEqual(new Set(['arrow-function', 'primitive']));
  });
});
