import path from 'node:path';

// The rule doesn't import `typescript`: the checker comes from the consumer's parser
// services, whose TS version may differ from ours. `TypeFlags` values changed between
// TS 5 and 6, so intrinsic types are recognized by name (`checker.typeToString`) instead.
// The `SymbolFlags` / `SignatureKind` values below are the same in TS 5 and 6.
const ANY_NAMES = new Set(['any', 'unknown']);
const EMPTY_NAMES = new Set(['null', 'undefined', 'void', 'never']);
const SYMBOL_FLAGS_INTERFACE = 64;
const SYMBOL_FLAGS_TYPE_ALIAS = 524288;
const SYMBOL_FLAGS_ALIAS = 2097152;
const SIGNATURE_KIND_CONSTRUCT = 1;

const MAX_TYPE_LENGTH = 80;

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure the variable behind a string ref (ref="name") is typed with the element or component it is bound to.',
    },
    messages: {
      untypedRef:
        'Ref "{{ref}}" is untyped ({{declared}}) but is bound to <{{tag}}>. Declare it as `ref<{{expected}}>()`.',
      untypedRefUnknownTag:
        'Ref "{{ref}}" is untyped ({{declared}}). Declare it with the type of what <{{tag}}> renders.',
      unwrappedRef:
        'Ref "{{ref}}" is bound to <{{tag}}> but its type is unwrapped by Vue (`ref<T>(initialValue)` types the value as `UnwrapRef<T>`). '
        + 'Declare it as `ref<{{expected}}>()` or `shallowRef<{{expected}} | null>(null)`.',
      refTypeMismatch:
        'Ref "{{ref}}" is typed "{{declared}}" but is bound to <{{tag}}> ({{expected}}).',
    },
    schema: [],
  },

  create(context) {
    const services = context.sourceCode.parserServices;

    // `jsx-ref-string-exists` already reports the missing type information
    if (!services?.program) return {};

    const checker = services.program.getTypeChecker();
    const toTs = (node) => services.esTreeNodeToTSNodeMap.get(node);

    return {
      JSXAttribute(node) {
        if (!isStringRef(node)) return;

        const refName = node.value.value;
        const opening = node.parent;
        const tag = getTagName(opening);
        if (!tag) return;

        const declared = getDeclaredRefType(checker, toTs, node, refName);
        // not found: `jsx-ref-string-exists` reports it
        if (!declared) return;

        const expected = isIntrinsicTag(tag)
          ? getIntrinsicElementType(checker, services.program, tag)
          : getComponentInstanceType(checker, toTs(opening.name), tag);

        const data = {
          ref: refName,
          tag,
          declared: typeToString(checker, declared),
          expected: expected?.name,
        };

        if (isUntyped(declared, checker)) {
          context.report({ node, messageId: expected ? 'untypedRef' : 'untypedRefUnknownTag', data });
          return;
        }

        // dynamic tag (`<Component>` from a slot) or unknown component: nothing to compare
        if (!expected) return;

        const target = checker.getNonNullableType(declared);
        if (checker.isTypeAssignableTo(expected.type, target)) return;

        // `ref<T>(initialValue)` types the value as `UnwrapRef<T>`: for a component it's a
        // structural copy of T, which T doesn't satisfy anymore, while the reverse still holds
        if (!isIntrinsicTag(tag) && checker.isTypeAssignableTo(target, expected.type)) {
          context.report({ node, messageId: 'unwrappedRef', data });
          return;
        }

        context.report({
          node,
          messageId: 'refTypeMismatch',
          data: { ...data, expected: typeToString(checker, expected.type) },
        });
      },
    };
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────

export function isStringRef(node) {
  return (
    node.name?.type === 'JSXIdentifier'
    && node.name.name === 'ref'
    && node.value?.type === 'Literal'
    && typeof node.value.value === 'string'
  );
}

/** `div`, `BaseInput`, `Foo.Bar`; `null` for `<ns:tag>` */
export function getTagName(opening) {
  const name = opening?.name;
  if (!name) return null;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    const object = getTagName({ name: name.object });
    return object && `${object}.${name.property.name}`;
  }
  return null;
}

/** JSX rule: a lowercase identifier (or one with a dash) is a native element */
export function isIntrinsicTag(tag) {
  return !tag.includes('.') && (/^[a-z]/.test(tag) || tag.includes('-'));
}

/**
 * Names the instance type of a component can be exported under, in its own file:
 * `export type BaseInput = Context<typeof setup, Props>` next to `export default defineComponent(...)`.
 */
export function getInstanceTypeNames(exportName, fileName, tag) {
  const names = [];
  const add = (n) => n && !names.includes(n) && names.push(n);

  if (exportName && exportName !== 'default') add(exportName);
  if (fileName) add(path.basename(fileName).replace(/\.(d\.)?[cm]?[tj]sx?$/, ''));
  add(tag.split('.').pop());

  return names;
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** Type of `refName` on the first enclosing function's first param that has it (the render context) */
function getDeclaredRefType(checker, toTs, node, refName) {
  for (let current = node.parent; current; current = current.parent) {
    if (!FUNCTION_TYPES.has(current.type) || !current.params?.length) continue;

    const tsParam = toTs(current.params[0]);
    const paramType = checker.getTypeAtLocation(tsParam);
    const prop = checker.getPropertyOfType(paramType, refName);
    if (prop) return checker.getTypeOfSymbolAtLocation(prop, tsParam);
  }
  return null;
}

export function isAnyOrUnknown(type, checker) {
  return ANY_NAMES.has(checker.typeToString(type));
}

/** `any`, `unknown`, or only `null` / `undefined` (`ref()`, `ref(null)`) */
export function isUntyped(type, checker) {
  if (isAnyOrUnknown(type, checker)) return true;
  const parts = type.isUnion?.() ? type.types : [type];
  return parts.every((t) => EMPTY_NAMES.has(checker.typeToString(t)));
}

const tagMapsCache = new WeakMap();

function getTagMaps(checker, program) {
  if (tagMapsCache.has(program)) return tagMapsCache.get(program);

  const maps = {};
  const file = program.getSourceFiles().find((f) => !f.isDeclarationFile) || program.getSourceFiles()[0];
  if (file) {
    for (const symbol of checker.getSymbolsInScope(file, SYMBOL_FLAGS_INTERFACE)) {
      if (['HTMLElementTagNameMap', 'SVGElementTagNameMap', 'Element'].includes(symbol.name)) {
        maps[symbol.name] = checker.getDeclaredTypeOfSymbol(symbol);
      }
    }
  }

  tagMapsCache.set(program, maps);
  return maps;
}

/** `div` → HTMLDivElement, `svg` → SVGSVGElement, unknown tag → Element */
function getIntrinsicElementType(checker, program, tag) {
  const maps = getTagMaps(checker, program);

  for (const mapName of ['HTMLElementTagNameMap', 'SVGElementTagNameMap']) {
    const map = maps[mapName];
    const prop = map && checker.getPropertyOfType(map, tag);
    if (prop) {
      const type = checker.getTypeOfSymbol(prop);
      return { type, name: typeToString(checker, type) };
    }
  }

  return maps.Element ? { type: maps.Element, name: 'Element' } : null;
}

function resolveAlias(checker, symbol) {
  return symbol && (symbol.flags & SYMBOL_FLAGS_ALIAS) ? checker.getAliasedSymbol(symbol) : symbol;
}

/**
 * Instance type of the component used as tag:
 * 1. the type exported with the component's name from the file declaring it
 *    (`export type BaseInput = Context<typeof setup, Props>`). Checked first: `TSXComponent`
 *    has no constructor, and generic factories (`export default GGrid<Obj>()`) construct
 *    Vue's raw instance type, not the one the code uses.
 * 2. else, for a Vue constructor (`DefineComponent`, third-party components): the type it constructs
 * `null` when it can't be resolved (`any` tag, unknown convention).
 */
function getComponentInstanceType(checker, tsTagNode, tag) {
  if (!tsTagNode) return null;

  const tagType = checker.getTypeAtLocation(tsTagNode);
  if (isAnyOrUnknown(tagType, checker)) return null;

  const exported = getExportedInstanceType(checker, tsTagNode, tag);
  if (exported) return exported;

  const [construct] = checker.getSignaturesOfType(tagType, SIGNATURE_KIND_CONSTRUCT);
  if (construct) {
    const type = construct.getReturnType();
    return { type, name: typeToString(checker, type) };
  }

  return null;
}

function getExportedInstanceType(checker, tsTagNode, tag) {
  const symbol = resolveAlias(checker, checker.getSymbolAtLocation(tsTagNode));
  const declaration = symbol?.declarations?.[0];
  if (!declaration) return null;

  const sourceFile = declaration.getSourceFile();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return null;

  const exports = checker.getExportsOfModule(moduleSymbol);
  for (const name of getInstanceTypeNames(symbol.name, sourceFile.fileName, tag)) {
    const exported = resolveAlias(checker, exports.find((e) => e.name === name));
    if (exported && (exported.flags & (SYMBOL_FLAGS_TYPE_ALIAS | SYMBOL_FLAGS_INTERFACE))) {
      return { type: checker.getDeclaredTypeOfSymbol(exported), name };
    }
  }

  return null;
}

function typeToString(checker, type) {
  const str = checker.typeToString(type);
  return str.length > MAX_TYPE_LENGTH ? `${str.slice(0, MAX_TYPE_LENGTH)}…` : str;
}
