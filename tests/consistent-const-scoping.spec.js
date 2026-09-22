import { parse } from '@babel/parser';
import { containsBlockingThis, isPureExpression } from '../src/consistent-const-scoping';

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
