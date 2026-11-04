import { parse } from '@babel/parser';
import { getModelTarget, getVModelAttrName } from '../src/no-v-model-on-prop';

// ─── helpers ────────────────────────────────────────────────────────────────

/** First JSX attribute of `<A {attr} />` */
const attrOf = (attr) => {
  const ast = parse(`<A ${attr} />`, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  return ast.program.body[0].expression.openingElement.attributes[0];
};

// babel uses `StringLiteral` / `OptionalMemberExpression`, close enough to ESTree here
const target = (attr) => {
  const t = getModelTarget(attrOf(attr).value.expression);
  return t && { object: t.object.name, name: t.name, nested: t.nested };
};

// ─── getVModelAttrName ──────────────────────────────────────────────────────

describe('GIVEN "no-v-model-on-prop" / getVModelAttrName', () => {
  it.each([
    ['v-model={c.value}', 'v-model'],
    ['v-model:selected={c.selected}', 'v-model:selected'],
    ['value={c.value}', null],
    ['onUpdate:value={c.set}', null],
  ])('THEN %s → %s', (attr, expected) => {
    expect(getVModelAttrName(attrOf(attr))).toBe(expected);
  });
});

// ─── getModelTarget ─────────────────────────────────────────────────────────

describe('GIVEN "no-v-model-on-prop" / getModelTarget', () => {
  it.each([
    ['v-model={c.value}', { object: 'c', name: 'value', nested: false }],
    ['v-model={c.row.recTp}', { object: 'c', name: 'row', nested: true }],
    ['v-model={c.searchFilter.a.b}', { object: 'c', name: 'searchFilter', nested: true }],
    ['v-model={c["value"]}', { object: 'c', name: 'value', nested: false }],
    ['v-model={c.value!}', { object: 'c', name: 'value', nested: false }],
    ['v-model={c.value as string}', { object: 'c', name: 'value', nested: false }],
    ['v-model={value}', null],
    ['v-model={c[key]}', null],
    ['v-model={getC().value}', null],
  ])('THEN %s → %j', (attr, expected) => {
    expect(target(attr)).toEqual(expected);
  });
});
