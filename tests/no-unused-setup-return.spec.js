import {
  getKeyName, getWholeContextUsage, isComponentFileName, isComposableFile, isUsed, stripComments, usesWholeContext,
} from '../src/no-unused-setup-return';

describe('GIVEN "no-unused-setup-return" / isComposableFile', () => {
  it.each([
    ['/a/useFoo.ts', true],
    ['/a/useFoo2.ts', true],
    ['/a/useRender.tsx', false],
    ['/a/useFoo.spec.ts', false],
    ['/a/Foo.ts', false],
    ['/a/user.ts', false],
  ])('THEN %s → %s', (file, expected) => {
    expect(isComposableFile(file)).toBe(expected);
  });
});

describe('GIVEN "no-unused-setup-return" / isUsed', () => {
  it.each([
    ['series', 'c.series.value', true],
    ['series', 'const { series } = c;', true],
    ['series', 'c.seriesCount', false],
    ['series', 'c.allseries', false],
    ['series', 'c.$series', false],
    ['grid', '<GGrid ref="grid" />', true],
    ['a.b', 'axb', false],
  ])('THEN %s in %s → %s', (name, text, expected) => {
    expect(isUsed(name, [text])).toBe(expected);
  });
});

describe('GIVEN "no-unused-setup-return" / stripComments', () => {
  it('THEN a commented use does not count', () => {
    const text = stripComments('// c.foo\n/* c.bar */\nc.baz; const u = "http://x";');
    expect(isUsed('foo', [text])).toBe(false);
    expect(isUsed('bar', [text])).toBe(false);
    expect(isUsed('baz', [text])).toBe(true);
    expect(text).toContain('http://x');
  });
});

describe('GIVEN "no-unused-setup-return" / usesWholeContext', () => {
  it.each([
    ['export default function (c: Foo) { return <A {...c} />; }', true],
    ['export default function (c: Foo) { return <A>{render(c)}</A>; }', true],
    ['export default function (c: Foo) { return <A>{render(a, c)}</A>; }', true],
    ['export default function (c: Foo) { return <A v={c.a} />; }', false],
    ['export default function (c: Foo) { return <A v={fn(c.a, c.b)} />; }', false],
    ['export default function ({ a }: Foo) { return <A v={a} />; }', false],
  ])('THEN %s → %s', (text, expected) => {
    expect(usesWholeContext(text)).toBe(expected);
  });
});

describe('GIVEN "no-unused-setup-return" / getKeyName', () => {
  it.each([
    [{ type: 'Property', computed: false, key: { type: 'Identifier', name: 'a' } }, 'a'],
    [{ type: 'Property', computed: false, key: { type: 'Literal', value: 'b' } }, 'b'],
    [{ type: 'Property', computed: true, key: { type: 'Identifier', name: 'c' } }, null],
    [{ type: 'SpreadElement' }, null],
  ])('THEN %j → %s', (prop, expected) => {
    expect(getKeyName(prop)).toBe(expected);
  });
});

describe('GIVEN "no-unused-setup-return" / getWholeContextUsage', () => {
  it.each([
    ['export default function (c: Foo) { return <A {...c} />; }', { spread: true, callees: [] }],
    ['export default function (c: Foo) { return <A>{render(c)}</A>; }', { spread: false, callees: ['render'] }],
    ['export default function (c: Foo) { return <A>{f(value, row, c)}</A>; }', { spread: false, callees: ['f'] }],
    ['export default function (c: Foo) { return <A v={c.a} />; }', { spread: false, callees: [] }],
  ])('THEN %s → %j', (text, expected) => {
    expect(getWholeContextUsage(text)).toEqual(expected);
  });
});

describe('GIVEN "no-unused-setup-return" / isComponentFileName', () => {
  it.each([
    ['/a/DailyPL.ts', true],
    ['/a/WorkspaceFoo.ts', true],
    ['/a/useDailyPL.ts', false],
    ['/a/useRender.tsx', false],
    ['/a/DailyPL.spec.ts', false],
    ['/a/types.d.ts', false],
  ])('THEN %s → %s', (file, expected) => {
    expect(isComponentFileName(file)).toBe(expected);
  });
});
