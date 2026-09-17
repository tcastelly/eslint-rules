import { parse } from '@babel/parser';
import rule, {
  DEFAULT_IGNORED_CLASSES,
  isMissingImportant,
  resolveIgnored,
  shouldFlag,
} from '../src/enforce-tailwind-important';

describe('GIVEN "enforce-tailwind-important"', () => {
  describe('WHEN "test" important class', () => {
    let isImportantClass = false;

    beforeEach(() => {
      isImportantClass = isMissingImportant('a-class');
    });

    it('THEN the class should not be important', () => {
      expect(isImportantClass).toBe(true);
    });
  });

  describe('WHEN a class is in the ignore list', () => {
    it('THEN "no-gutters" and "container-fluid" are ignored by default', () => {
      expect(DEFAULT_IGNORED_CLASSES).toEqual(
        expect.arrayContaining(['no-gutters', 'container-fluid']),
      );
    });

    it('THEN a default-ignored class is not flagged', () => {
      const ignored = resolveIgnored();

      expect(shouldFlag('no-gutters', ignored)).toBe(false);
      expect(shouldFlag('container-fluid', ignored)).toBe(false);
    });

    it('THEN a real Tailwind class is still flagged', () => {
      const ignored = resolveIgnored();

      expect(shouldFlag('w-full', ignored)).toBe(true);
      expect(shouldFlag('max-w-[800px]', ignored)).toBe(true);
    });

    it('THEN an already-important class is never flagged', () => {
      const ignored = resolveIgnored();

      expect(shouldFlag('w-full!', ignored)).toBe(false);
    });

    it('THEN classes from the "ignore" option are merged with the defaults', () => {
      const ignored = resolveIgnored({ ignore: ['my-legacy-class'] });

      expect(shouldFlag('my-legacy-class', ignored)).toBe(false);
      expect(shouldFlag('no-gutters', ignored)).toBe(false);
      expect(shouldFlag('text-red-500', ignored)).toBe(true);
    });
  });
});

// ─── rule (end-to-end) ──────────────────────────────────────────────────────

/** Run the rule on `code`, return reported classes and the auto-fixed source. */
const lint = (code, options = []) => {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'estree'] });
  const reports = [];
  const context = {
    options,
    getSourceCode: () => ({ getText: (node) => code.slice(node.start, node.end) }),
    report: (r) => reports.push(r),
  };
  const visitors = rule.create(context);

  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    visitors[node.type]?.(node);
    Object.keys(node).forEach((key) => {
      const value = node[key];
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value.type === 'string') walk(value);
    });
  };
  walk(ast.program);

  // apply fixes from the end so offsets stay valid
  let output = code;
  reports
    .map((r) => r.fix({ replaceText: (node, text) => ({ node, text }) }))
    .sort((a, b) => b.node.start - a.node.start)
    .forEach(({ node, text }) => {
      output = output.slice(0, node.start) + text + output.slice(node.end);
    });

  return { reports, output };
};

describe('GIVEN "enforce-tailwind-important" / logical expressions', () => {
  it('THEN `cond && "cls"` is flagged and fixed', () => {
    const { reports, output } = lint("const x = <div class={readonly && 'hidden'} />;");

    expect(reports).toHaveLength(1);
    expect(output).toBe("const x = <div class={readonly && 'hidden!'} />;");
  });

  it('THEN only the missing classes are fixed', () => {
    const { output } = lint("const x = <div className={readonly && 'something! else'} />;");

    expect(output).toBe("const x = <div className={readonly && 'something! else!'} />;");
  });

  it('THEN already-important classes are not flagged', () => {
    const { reports } = lint("const x = <div class={readonly && 'something! else!'} />;");

    expect(reports).toHaveLength(0);
  });

  it('THEN both sides of `||` / `??` are checked', () => {
    const { output } = lint("const x = <div class={(a || 'flex') ?? 'grid'} />;");

    expect(output).toBe("const x = <div class={(a || 'flex!') ?? 'grid!'} />;");
  });

  it('THEN the left side of `&&` is not treated as a class', () => {
    const { reports } = lint("const x = <div class={'foo' && 'bar!'} />;");

    expect(reports).toHaveLength(0);
  });

  it('THEN nested ternary / logical expressions are checked', () => {
    const { output } = lint("const x = <div class={a ? b && 'p-2' : 'm-2'} />;");

    expect(output).toBe("const x = <div class={a ? b && 'p-2!' : 'm-2!'} />;");
  });

  it('THEN logical expressions inside an array are checked', () => {
    const { reports, output } = lint(
      "const x = <div class={[readonly && 'hidden', 'something', 'else']} />;",
    );

    expect(reports).toHaveLength(3);
    expect(output).toBe(
      "const x = <div class={[readonly && 'hidden!', 'something!', 'else!']} />;",
    );
  });

  it('THEN array elements that are already important are not flagged', () => {
    const { reports } = lint(
      "const x = <div class={[readonly && 'hidden!', 'something!', { 'p-2!': a }]} />;",
    );

    expect(reports).toHaveLength(0);
  });

  it('THEN non-string literals do not crash', () => {
    expect(() => lint('const x = <div class={count && 0} />;')).not.toThrow();
  });
});
