import type { PrimitiveDefinition, PrimitiveKind } from './index';

const PRIMITIVE_KINDS: PrimitiveKind[] = ['hash', 'curve', 'encoding'];

type PrimitiveDefinitionMap = {
  [K in PrimitiveKind]: Map<string, number>;
};

type PrimitiveReverseDefinitionMap = {
  [K in PrimitiveKind]: Map<number, string>;
};

const createNameMaps = (): PrimitiveDefinitionMap => ({
  hash: new Map<string, number>(),
  curve: new Map<string, number>(),
  encoding: new Map<string, number>(),
});

const createCodeMaps = (): PrimitiveReverseDefinitionMap => ({
  hash: new Map<number, string>(),
  curve: new Map<number, string>(),
  encoding: new Map<number, string>(),
});

const normalizePrimitiveKind = (kind: unknown): PrimitiveKind => {
  if (kind === 'hash' || kind === 'curve' || kind === 'encoding') {
    return kind;
  }
  throw new Error(`Invalid primitive kind: ${String(kind)}`);
};

const normalizePrimitiveName = (name: unknown): string => {
  if (typeof name !== 'string') {
    throw new Error(`Invalid primitive name: ${String(name)}`);
  }
  const normalized = name.trim().toUpperCase();
  if (!normalized) {
    throw new Error('Primitive name cannot be empty');
  }
  return normalized;
};

const normalizePrimitiveCode = (code: unknown): number => {
  if (
    typeof code !== 'number' ||
    !Number.isFinite(code) ||
    !Number.isInteger(code) ||
    code < 0
  ) {
    throw new Error(`Invalid primitive code: ${String(code)}`);
  }
  return code;
};

const normalizeDefinition = (definition: PrimitiveDefinition) => {
  const kind = normalizePrimitiveKind(definition.kind);
  const name = normalizePrimitiveName(definition.name);
  const code = normalizePrimitiveCode(definition.code);
  return { kind, name, code };
};

const sortDefinitions = (
  definitions: PrimitiveDefinition[],
): PrimitiveDefinition[] => {
  return [...definitions].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.code - b.code;
  });
};

const normalizeDefinitions = (
  definitions: PrimitiveDefinition[],
): PrimitiveDefinition[] => {
  if (!Array.isArray(definitions)) {
    throw new Error('Primitive definitions must be an array');
  }
  return definitions.map(normalizeDefinition);
};

export class PrimitiveConflictError extends Error {
  public readonly kind: PrimitiveKind;
  public readonly primitiveName: string;
  public readonly code: number;

  constructor(message: string, def: PrimitiveDefinition) {
    super(message);
    this.name = 'PrimitiveConflictError';
    this.kind = def.kind;
    this.primitiveName = def.name;
    this.code = def.code;
  }
}

export type PrimitiveRegistry = {
  register: (definitions: PrimitiveDefinition[]) => void;
  preflight: (definitions: PrimitiveDefinition[]) => void;
  resolve: (kind: PrimitiveKind, name: string) => number | undefined;
  resolveOrThrow: (kind: PrimitiveKind, name: string) => number;
  reverseResolve: (kind: PrimitiveKind, code: number) => string | undefined;
  has: (kind: PrimitiveKind, name: string) => boolean;
  list: (kind?: PrimitiveKind) => PrimitiveDefinition[];
  reset: () => void;
};

export function createPrimitiveRegistry(): PrimitiveRegistry {
  const nameToCode = createNameMaps();
  const codeToName = createCodeMaps();

  const checkConflict = (
    stagedNameToCode: PrimitiveDefinitionMap,
    stagedCodeToName: PrimitiveReverseDefinitionMap,
    def: PrimitiveDefinition,
  ) => {
    const existingCode = stagedNameToCode[def.kind].get(def.name);
    if (existingCode !== undefined && existingCode !== def.code) {
      throw new PrimitiveConflictError(
        `Primitive conflict for ${def.kind}:${def.name}. Existing code=${existingCode}, new code=${def.code}.`,
        def,
      );
    }

    const existingName = stagedCodeToName[def.kind].get(def.code);
    if (existingName !== undefined && existingName !== def.name) {
      throw new PrimitiveConflictError(
        `Primitive conflict for ${def.kind} code=${def.code}. Existing name=${existingName}, new name=${def.name}.`,
        def,
      );
    }
  };

  const preflight = (definitions: PrimitiveDefinition[]) => {
    const normalized = normalizeDefinitions(definitions);
    const stagedNameToCode = createNameMaps();
    const stagedCodeToName = createCodeMaps();

    for (const kind of PRIMITIVE_KINDS) {
      nameToCode[kind].forEach((code, name) => {
        stagedNameToCode[kind].set(name, code);
      });
      codeToName[kind].forEach((name, code) => {
        stagedCodeToName[kind].set(code, name);
      });
    }

    for (const def of normalized) {
      checkConflict(stagedNameToCode, stagedCodeToName, def);
      stagedNameToCode[def.kind].set(def.name, def.code);
      stagedCodeToName[def.kind].set(def.code, def.name);
    }
  };

  const register = (definitions: PrimitiveDefinition[]) => {
    const normalized = normalizeDefinitions(definitions);
    preflight(normalized);

    for (const def of normalized) {
      nameToCode[def.kind].set(def.name, def.code);
      codeToName[def.kind].set(def.code, def.name);
    }
  };

  const resolve = (kind: PrimitiveKind, name: string): number | undefined => {
    return nameToCode[kind].get(normalizePrimitiveName(name));
  };

  const resolveOrThrow = (kind: PrimitiveKind, name: string): number => {
    const code = resolve(kind, name);
    if (code === undefined) {
      throw new Error(`Primitive not found: ${kind}:${name}`);
    }
    return code;
  };

  const reverseResolve = (
    kind: PrimitiveKind,
    code: number,
  ): string | undefined => {
    return codeToName[kind].get(normalizePrimitiveCode(code));
  };

  const has = (kind: PrimitiveKind, name: string): boolean => {
    return resolve(kind, name) !== undefined;
  };

  const list = (kind?: PrimitiveKind): PrimitiveDefinition[] => {
    const definitions: PrimitiveDefinition[] = [];
    const kinds = kind ? [kind] : PRIMITIVE_KINDS;

    for (const currentKind of kinds) {
      nameToCode[currentKind].forEach((code, name) => {
        definitions.push({
          kind: currentKind,
          name,
          code,
        });
      });
    }

    return sortDefinitions(definitions);
  };

  const reset = () => {
    for (const kind of PRIMITIVE_KINDS) {
      nameToCode[kind].clear();
      codeToName[kind].clear();
    }
  };

  return {
    register,
    preflight,
    resolve,
    resolveOrThrow,
    reverseResolve,
    has,
    list,
    reset,
  };
}
