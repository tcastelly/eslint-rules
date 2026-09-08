import { parse } from '@babel/parser';
import { analyzeFragment, classifyFragment, isKeylessFragment } from '../src/require-fragment-key';

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

const collectFragments = (node, out = []) => {
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'JSXFragment' || node.type === 'JSXElement') out.push(node);
  Object.keys(node).forEach((key) => {
    if (key === 'parent') return;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => collectFragments(child, out));
    else if (value && typeof value.type === 'string') collectFragments(value, out);
  });
  return out;
};

/** Parse `code`, return every messageId the rule would emit (in source order). */
const lint = (code, options) => {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  linkParents(ast.program);
  return collectFragments(ast.program)
    .map((node) => analyzeFragment(node, options))
    .filter(Boolean);
};

// ─── isKeylessFragment ──────────────────────────────────────────────────────

describe('GIVEN "require-fragment-key" / isKeylessFragment', () => {
  const first = (code) => {
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    return collectFragments(ast.program).find(
      (n) => n.type === 'JSXFragment'
        || (n.type === 'JSXElement' && n.openingElement.name.name === 'Fragment'),
    );
  };

  it('THEN a shorthand fragment is key-less', () => {
    expect(isKeylessFragment(first('const x = <><A/></>;'))).toBe(true);
  });

  it('THEN a <Fragment> without key is key-less', () => {
    expect(isKeylessFragment(first('const x = <Fragment><A/></Fragment>;'))).toBe(true);
  });

  it('THEN a <Fragment key=…> is NOT key-less', () => {
    expect(isKeylessFragment(first('const x = <Fragment key="k"><A/></Fragment>;'))).toBe(false);
  });

  it('THEN a <Fragment {...spread}> is treated as keyed (no guessing)', () => {
    expect(isKeylessFragment(first('const x = <Fragment {...p}><A/></Fragment>;'))).toBe(false);
  });
});

// ─── positions that DO require a key ────────────────────────────────────────

describe('GIVEN "require-fragment-key" / required positions', () => {
  it('THEN a fragment returned from .map is a list item', () => {
    expect(lint('const x = list.map((i) => (<><A/><B/></>));')).toEqual(['listItem']);
  });

  it('THEN a conditional fragment inside .map is a list item', () => {
    expect(lint('const x = list.map((i) => i.ok && (<><A/></>));')).toEqual(['listItem']);
  });

  it('THEN a fragment returned from a .map block statement is a list item', () => {
    expect(lint('const x = list.map((i) => { return <><A/></>; });')).toEqual(['listItem']);
  });

  it('THEN a conditional fragment beside another dynamic sibling must be keyed', () => {
    const code = 'const x = (<P><L/>{a && <X/>}{c && (<><A/><B/></>)}<S/></P>);';
    expect(lint(code)).toEqual(['conditionalSibling']);
  });

  it('THEN a v-if / v-else pair of fragments must both be keyed', () => {
    const code = 'const x = (<P>{c ? (<><A/></>) : (<><B/></>)}{other && <Y/>}</P>);';
    expect(lint(code)).toEqual(['conditionalSibling', 'conditionalSibling']);
  });

  it('THEN a conditional fragment beside a .map sibling must be keyed', () => {
    const code = 'const x = (<P><L/>{c && (<><A/></>)}{rows.map((r) => <Row />)}</P>);';
    expect(lint(code)).toEqual(['conditionalSibling']);
  });

  it('THEN a lone conditional fragment in a static list is flagged only when strict:false', () => {
    const code = 'const x = (<P><L/>{c && (<><A/><B/></>)}</P>);';
    expect(lint(code)).toEqual([]);
    expect(lint(code, { strict: false })).toEqual(['conditionalSibling']);
  });
});

// ─── positions that do NOT require a key ────────────────────────────────────

describe('GIVEN "require-fragment-key" / allowed positions', () => {
  it('THEN the sole return of an arrow is fine', () => {
    expect(lint('const f = () => (<><A/><B/></>);')).toEqual([]);
  });

  it('THEN the sole return of a render function is fine', () => {
    expect(lint('function r() { return (<><A/><B/></>); }')).toEqual([]);
  });

  it('THEN a slot function returning a fragment is fine', () => {
    expect(lint('const s = { default: () => (<><A/><B/></>) };')).toEqual([]);
  });

  it('THEN a conditional fragment that is the whole return is fine', () => {
    expect(lint('const f = () => cond && (<><A/><B/></>);')).toEqual([]);
    expect(lint('const f = () => (cond ? (<><A/></>) : (<><B/></>));')).toEqual([]);
  });

  it('THEN a fragment that is the only child of a parent is fine', () => {
    expect(lint('const x = (<Parent>{cond && (<><A/><B/></>)}</Parent>);')).toEqual([]);
  });

  it('THEN an already-keyed fragment is fine', () => {
    const code = 'const x = (<P><L/>{c && (<Fragment key="k"><A/></Fragment>)}{d && <Y/>}</P>);';
    expect(lint(code)).toEqual([]);
  });

  it('THEN a static (non-conditional) sibling fragment is fine', () => {
    expect(lint('const x = (<Parent><Legend/><><A/><B/></></Parent>);')).toEqual([]);
  });
});

// ─── classifyFragment (white-box) ──────────────────────────────────────────

describe('GIVEN "require-fragment-key" / classifyFragment', () => {
  const classifyFirst = (code) => {
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    linkParents(ast.program);
    return classifyFragment(collectFragments(ast.program).find((n) => n.type === 'JSXFragment'));
  };

  it('THEN it counts significant siblings and dynamic siblings', () => {
    const info = classifyFirst('const x = (<P><L/>{a && <X/>}{c && (<><A/></>)}<S/></P>);');
    expect(info.kind).toBe('jsx-child');
    expect(info.conditional).toBe(true);
    expect(info.siblingCount).toBe(3);
    expect(info.dynamicSibling).toBe(true);
  });

  it('THEN a sole return classifies as "return"', () => {
    expect(classifyFirst('const f = () => (<><A/></>);').kind).toBe('return');
  });
});
