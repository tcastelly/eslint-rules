import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  findOwnComponent, getKeyName, getWholeContextUsage, isComponentFileName, isComposableFile, isImportedElsewhere, isPublicComment, readImportedRenders, isUsed, stripComments, usesWholeContext,
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
    ['export default function (c: Foo) { return <A {...c.$attrs} {...c?.b} {...c[k]} />; }', { spread: false, callees: [] }],
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

describe('GIVEN "no-unused-setup-return" / isImportedElsewhere', () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nusr-'));
    const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
    w('package.json', '{}');
    w('src/a/useA.ts', 'export default () => ({})');
    w('src/a/A.ts', "import setup from './useA';");
    w('src/b/B.ts', "import useA from '../a/useA';");
    w('src/c/useC.ts', 'export default () => ({})');
    w('src/c/C.ts', "import setup from './useC';");
    w('src/d/useD.ts', 'export default () => ({})');
    w('src/e/E.ts', "import useD from '../x/useD';");
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('THEN imported by another directory → true', () => {
    expect(isImportedElsewhere(path.join(dir, 'src/a/useA.ts'))).toBe(true);
  });
  it('THEN imported only by its own directory → false', () => {
    expect(isImportedElsewhere(path.join(dir, 'src/c/useC.ts'))).toBe(false);
  });
  it('THEN a relative import resolving elsewhere is ignored → false', () => {
    expect(isImportedElsewhere(path.join(dir, 'src/d/useD.ts'))).toBe(false);
  });
});

describe('GIVEN "no-unused-setup-return" / readImportedRenders', () => {
  it('THEN reads a shared render of the parent directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nusr-r-'));
    fs.mkdirSync(path.join(dir, 'child'));
    fs.writeFileSync(path.join(dir, 'useShared.tsx'), '// c.nope\nexport default (c) => c.formTitle;');
    const texts = readImportedRenders("import render from '../useShared';\nimport other from './x';", path.join(dir, 'child'));
    expect(texts).toHaveLength(1);
    expect(isUsed('formTitle', texts)).toBe(true);
    expect(isUsed('nope', texts)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('THEN an alias import is ignored', () => {
    expect(readImportedRenders("import render from '@/x/render';", '/tmp')).toEqual([]);
  });
});

describe('GIVEN "no-unused-setup-return" / isPublicComment', () => {
  it.each([
    // comment values, as given by ESLint (without the delimiters)
    ['* @public ', true], // /** @public */
    [' @public', true], // // @public
    [' @public called by the parent', true],
    ['*\n   * Focus the input\n   * @public\n   ', true], // multi-line JSDoc
    [' public', false],
    [' @publicApi', false],
    [' not @public-ish', false],
    [' foo@public', false],
  ])('THEN %j → %s', (text, expected) => {
    expect(isPublicComment(text)).toBe(expected);
  });
});

describe('GIVEN "no-unused-setup-return" / findOwnComponent', () => {
  const sibling = (name, text, inner = false) => ({
    name, text, inner, isRender: false, isComposable: /^use[A-Z]/.test(name),
  });
  const other = sibling('VGridColumnActionRender.ts', "import setup from '@/widgets/useAbstractRender';\nexport default defineComponent({ setup });");
  const own = sibling('VGridColumns.ts', "import setup from './useVGridColumns';\nexport default defineComponent({ setup });");

  it('THEN skips another component of the directory listed first', () => {
    expect(findOwnComponent([other, own], 'useVGridColumns')).toBe(own);
  });
  it('THEN accepts an import with an extension', () => {
    const withExt = sibling('A.ts', "import setup from './useA.ts';\ndefineComponent({ setup });");
    expect(findOwnComponent([withExt], 'useA')).toBe(withExt);
  });
  it('THEN no component imports the composable → undefined', () => {
    expect(findOwnComponent([other], 'useVGridColumns')).toBeUndefined();
  });
  it('THEN a component of a sub-directory is ignored', () => {
    const inner = sibling('VGridColumns.ts', own.text, true);
    expect(findOwnComponent([inner], 'useVGridColumns')).toBeUndefined();
  });
  it('THEN a composable importing it is not a component', () => {
    const composable = sibling('useB.ts', "import useA from './useA';\ndefineComponent({});");
    expect(findOwnComponent([composable], 'useA')).toBeUndefined();
  });
});
