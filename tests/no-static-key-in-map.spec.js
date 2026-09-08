import { parse } from '@babel/parser';
import {
  analyzeElement,
  getStaticKeyAttr,
  isListItemRoot,
  isStaticExpression,
} from '../src/no-static-key-in-map';

// ─── helpers ────────────────────────────────────────────────────────────────

const linkParents = (node, parent = null) => {
  if (!node || typeof node.type !== 'string') return;
  node.parent = parent;
  Object.keys(node).forEach((key) => {
    if (key === 'parent') return;
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((child) => linkParents(child, node));
    } else if (value && typeof value.type === 'string') {
      linkParents(value, node);
    }
  });
};

const collectElements = (node, out = []) => {
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'JSXElement') out.push(node);
  Object.keys(node).forEach((key) => {
    if (key === 'parent') return;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => collectElements(child, out));
    else if (value && typeof value.type === 'string') collectElements(value, out);
  });
  return out;
};

/** Parse `code`, return every messageId the rule would emit (in source order). */
const lint = (code) => {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  linkParents(ast.program);
  return collectElements(ast.program)
    .map((node) => analyzeElement(node))
    .filter(Boolean);
};

const firstElement = (code) => {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  linkParents(ast.program);
  return collectElements(ast.program)[0];
};

// ─── isStaticExpression ─────────────────────────────────────────────────────

describe('GIVEN "no-static-key-in-map" / isStaticExpression', () => {
  const expr = (code) => parse(`(${code})`, { plugins: ['typescript'] }).program.body[0].expression;

  it.each([
    ['"row"', true],
    ['42', true],
    ['true', true],
    ['`row`', true],
    ['`row-${i}`', false],
    ['i', false],
    ['item.id', false],
    ['getKey()', false],
    ['"row" as string', true],
  ])('THEN %s → static:%s', (code, isStatic) => {
    expect(isStaticExpression(expr(code))).toBe(isStatic);
  });
});

// ─── getStaticKeyAttr ───────────────────────────────────────────────────────

describe('GIVEN "no-static-key-in-map" / getStaticKeyAttr', () => {
  it('THEN a string key is static', () => {
    expect(getStaticKeyAttr(firstElement('const x = <A key="row" />;'))).toBeTruthy();
  });

  it('THEN a braced literal key is static', () => {
    expect(getStaticKeyAttr(firstElement('const x = <A key={"row"} />;'))).toBeTruthy();
    expect(getStaticKeyAttr(firstElement('const x = <A key={1} />;'))).toBeTruthy();
    expect(getStaticKeyAttr(firstElement('const x = <A key={`row`} />;'))).toBeTruthy();
  });

  it('THEN a <Fragment key="…"> is static', () => {
    expect(getStaticKeyAttr(firstElement('const x = <Fragment key="rows" />;'))).toBeTruthy();
  });

  it('THEN a dynamic key is NOT static', () => {
    expect(getStaticKeyAttr(firstElement('const x = <A key={i} />;'))).toBeNull();
    expect(getStaticKeyAttr(firstElement('const x = <A key={item.id} />;'))).toBeNull();
    expect(getStaticKeyAttr(firstElement('const x = <A key={`row-${i}`} />;'))).toBeNull();
  });

  it('THEN a missing key is NOT static', () => {
    expect(getStaticKeyAttr(firstElement('const x = <A />;'))).toBeNull();
  });
});

// ─── positions that DO trigger ─────────────────────────────────────────────

describe('GIVEN "no-static-key-in-map" / flagged positions', () => {
  it('THEN a static key on a .map arrow-body element', () => {
    expect(lint('const x = list.map((i) => <Row key="row" />);')).toEqual(['staticKeyInIterator']);
  });

  it('THEN a static key on a .map block-return element', () => {
    expect(lint('const x = list.map((i) => { return <Row key="row" />; });')).toEqual(['staticKeyInIterator']);
  });

  it('THEN a static <Fragment> key inside .map', () => {
    const code = 'const x = list.map((i) => <Fragment key="rows"><A/><B/></Fragment>);';
    expect(lint(code)).toEqual(['staticKeyInIterator']);
  });

  it('THEN a conditional element inside .map with a static key', () => {
    expect(lint('const x = list.map((i) => i.ok && <Row key="row" />);')).toEqual(['staticKeyInIterator']);
    expect(lint('const x = list.map((i) => (i.ok ? <A key="a" /> : <B key="b" />));'))
      .toEqual(['staticKeyInIterator', 'staticKeyInIterator']);
  });

  it('THEN every static-keyed element of an array returned from .flatMap', () => {
    const code = 'const x = list.flatMap((i) => [<A key="a" />, <B key="b" />]);';
    expect(lint(code)).toEqual(['staticKeyInIterator', 'staticKeyInIterator']);
  });

  it('THEN a parenthesised / cast list item is still flagged', () => {
    expect(lint('const x = list.map((i) => (<Row key="row" />));')).toEqual(['staticKeyInIterator']);
  });
});

// ─── positions that do NOT trigger ─────────────────────────────────────────

describe('GIVEN "no-static-key-in-map" / allowed positions', () => {
  it('THEN a dynamic key in .map is fine', () => {
    expect(lint('const x = list.map((r) => <Row key={r.id} />);')).toEqual([]);
    expect(lint('const x = list.map((r, i) => <Row key={i} />);')).toEqual([]);
    expect(lint('const x = list.map((r, i) => <Row key={`row-${i}`} />);')).toEqual([]);
  });

  it('THEN a static key on a NESTED element (not the list-item root) is fine', () => {
    const code = 'const x = list.map((r) => <ul key={r.id}><li key="only">{r.n}</li></ul>);';
    expect(lint(code)).toEqual([]);
  });

  it('THEN static keys among the children of a fragment list-item root are fine', () => {
    const code = 'const x = list.map((r) => <Fragment key={r.id}><A key="a" /><B key="b" /></Fragment>);';
    expect(lint(code)).toEqual([]);
  });

  it('THEN a static key outside any iterator is fine', () => {
    expect(lint('const x = <Row key="row" />;')).toEqual([]);
    expect(lint('const x = cond && <Row key="row" />;')).toEqual([]);
  });

  it('THEN a missing key is not this rule\'s concern', () => {
    expect(lint('const x = list.map((r) => <Row />);')).toEqual([]);
  });

  it('THEN forEach / other non-iterator callbacks are ignored', () => {
    expect(lint('list.forEach((r) => render(<Row key="row" />));')).toEqual([]);
  });
});

// ─── isListItemRoot (white-box) ────────────────────────────────────────────

describe('GIVEN "no-static-key-in-map" / isListItemRoot', () => {
  it('THEN the arrow body of .map is a list-item root', () => {
    expect(isListItemRoot(firstElement('const x = list.map((i) => <A key="a" />);'))).toBe(true);
  });

  it('THEN a nested element is not', () => {
    // collectElements order is outer-first, so [1] is the inner <li>
    const ast = parse('const x = list.map((i) => <ul><li key="x" /></ul>);', {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    linkParents(ast.program);
    const inner = collectElements(ast.program)[1];
    expect(isListItemRoot(inner)).toBe(false);
  });

  it('THEN an element outside a .map is not', () => {
    expect(isListItemRoot(firstElement('const x = <A key="a" />;'))).toBe(false);
  });
});
