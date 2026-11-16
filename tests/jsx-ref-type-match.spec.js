import { parse } from '@babel/parser';
import {
  getInstanceTypeNames, getTagName, isAnyOrUnknown, isIntrinsicTag, isStringRef, isUntyped,
} from '../src/jsx-ref-type-match';

// ─── helpers ────────────────────────────────────────────────────────────────

const openingOf = (jsx) => {
  const ast = parse(jsx, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  return ast.program.body[0].expression.openingElement;
};

// babel uses `StringLiteral`, ESTree (typescript-eslint) uses `Literal`
const toEstree = (attr) => (attr.value?.type === 'StringLiteral'
  ? { ...attr, value: { ...attr.value, type: 'Literal' } }
  : attr);

// minimal checker / types: intrinsic types are recognized by their printed name
const checker = {
  typeToString: (t) => (t.isUnion() ? t.types.map((u) => u.name).join(' | ') : t.name),
};
const single = (name) => ({ name, isUnion: () => false });
const type = (...names) => (names.length === 1
  ? single(names[0])
  : { isUnion: () => true, types: names.map(single) });

// ─── isStringRef ────────────────────────────────────────────────────────────

describe('GIVEN "jsx-ref-type-match" / isStringRef', () => {
  it.each([
    ['<div ref="root" />', true],
    ['<div ref={root} />', false],
    ['<div ref={"root"} />', false],
    ['<div id="root" />', false],
  ])('THEN %s → %s', (jsx, expected) => {
    expect(isStringRef(toEstree(openingOf(jsx).attributes[0]))).toBe(expected);
  });
});

// ─── getTagName ─────────────────────────────────────────────────────────────

describe('GIVEN "jsx-ref-type-match" / getTagName', () => {
  it.each([
    ['<div />', 'div'],
    ['<BaseInput />', 'BaseInput'],
    ['<Foo.Bar />', 'Foo.Bar'],
    ['<A.B.C />', 'A.B.C'],
    ['<svg:rect />', null],
  ])('THEN %s → %s', (jsx, expected) => {
    expect(getTagName(openingOf(jsx))).toBe(expected);
  });
});

// ─── isIntrinsicTag ─────────────────────────────────────────────────────────

describe('GIVEN "jsx-ref-type-match" / isIntrinsicTag', () => {
  it.each([
    ['div', true],
    ['svg', true],
    ['my-element', true],
    ['BaseInput', false],
    ['Component', false],
    ['icons.Check', false],
  ])('THEN %s → %s', (tag, expected) => {
    expect(isIntrinsicTag(tag)).toBe(expected);
  });
});

// ─── getInstanceTypeNames ───────────────────────────────────────────────────

describe('GIVEN "jsx-ref-type-match" / getInstanceTypeNames', () => {
  it.each([
    // `export default defineComponent(...)` in BaseInput.ts
    ['default', '/src/form/BaseInput.ts', 'BaseInput', ['BaseInput']],
    // imported under another name: the file name wins over the tag
    ['default', '/src/form/BaseInput.ts', 'Input', ['BaseInput', 'Input']],
    // named export
    ['VDropdown', '/src/dropdown/index.ts', 'VDropdown', ['VDropdown', 'index']],
    ['default', '/src/a/Foo.tsx', 'Foo', ['Foo']],
    ['default', '/src/a/Foo.d.ts', 'Foo', ['Foo']],
    ['default', '/src/a/Foo.ts', 'NS.Foo', ['Foo']],
  ])('THEN (%s, %s, %s) → %j', (exportName, fileName, tag, expected) => {
    expect(getInstanceTypeNames(exportName, fileName, tag)).toEqual(expected);
  });
});

// ─── isUntyped ──────────────────────────────────────────────────────────────

describe('GIVEN "jsx-ref-type-match" / isUntyped', () => {
  it.each([
    [['any'], true], // ref()
    [['unknown'], true],
    [['null'], true], // ref(null)
    [['undefined'], true],
    [['null', 'undefined'], true],
    [['void'], true],
    [['HTMLDivElement'], false], // ref<HTMLDivElement>() unwrapped
    [['HTMLDivElement', 'undefined'], false],
    [['BaseInput', 'null'], false],
    [['string'], false],
    [['anything'], false], // the name must match exactly
  ])('THEN %j → %s', (names, expected) => {
    expect(isUntyped(type(...names), checker)).toBe(expected);
  });
});

// ─── isAnyOrUnknown ─────────────────────────────────────────────────────────

describe('GIVEN "jsx-ref-type-match" / isAnyOrUnknown', () => {
  it.each([
    ['any', true],
    ['unknown', true],
    ['null', false],
    ['VDropdown', false],
  ])('THEN %s → %s', (name, expected) => {
    expect(isAnyOrUnknown(single(name), checker)).toBe(expected);
  });
});
