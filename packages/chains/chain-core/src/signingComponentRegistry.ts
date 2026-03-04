import type { SigningComponentDefinition, SigningComponentKind } from './index';

const SIGNING_COMPONENT_KINDS: SigningComponentKind[] = [
  'hash',
  'curve',
  'encoding',
];

type SigningComponentDefinitionMap = {
  [K in SigningComponentKind]: Map<string, number>;
};

type SigningComponentReverseDefinitionMap = {
  [K in SigningComponentKind]: Map<number, string>;
};

const createNameMaps = (): SigningComponentDefinitionMap => ({
  hash: new Map<string, number>(),
  curve: new Map<string, number>(),
  encoding: new Map<string, number>(),
});

const createCodeMaps = (): SigningComponentReverseDefinitionMap => ({
  hash: new Map<number, string>(),
  curve: new Map<number, string>(),
  encoding: new Map<number, string>(),
});

const normalizeSigningComponentKind = (kind: unknown): SigningComponentKind => {
  if (kind === 'hash' || kind === 'curve' || kind === 'encoding') {
    return kind;
  }
  throw new Error(`Invalid signing component kind: ${String(kind)}`);
};

const normalizeSigningComponentName = (name: unknown): string => {
  if (typeof name !== 'string') {
    throw new Error(`Invalid signing component name: ${String(name)}`);
  }
  const normalized = name.trim().toUpperCase();
  if (!normalized) {
    throw new Error('Signing component name cannot be empty');
  }
  return normalized;
};

const normalizeSigningComponentCode = (code: unknown): number => {
  if (
    typeof code !== 'number' ||
    !Number.isFinite(code) ||
    !Number.isInteger(code) ||
    code < 0
  ) {
    throw new Error(`Invalid signing component code: ${String(code)}`);
  }
  return code;
};

const normalizeDefinition = (definition: SigningComponentDefinition) => {
  const kind = normalizeSigningComponentKind(definition.kind);
  const name = normalizeSigningComponentName(definition.name);
  const code = normalizeSigningComponentCode(definition.code);
  return { kind, name, code };
};

const sortDefinitions = (
  definitions: SigningComponentDefinition[],
): SigningComponentDefinition[] => {
  return [...definitions].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.code - b.code;
  });
};

const normalizeDefinitions = (
  definitions: SigningComponentDefinition[],
): SigningComponentDefinition[] => {
  if (!Array.isArray(definitions)) {
    throw new Error('Signing component definitions must be an array');
  }
  return definitions.map(normalizeDefinition);
};

export class SigningComponentConflictError extends Error {
  public readonly kind: SigningComponentKind;
  public readonly componentName: string;
  public readonly code: number;

  constructor(message: string, def: SigningComponentDefinition) {
    super(message);
    this.name = 'SigningComponentConflictError';
    this.kind = def.kind;
    this.componentName = def.name;
    this.code = def.code;
  }
}

export type SigningComponentRegistry = {
  register: (definitions: SigningComponentDefinition[]) => void;
  preflight: (definitions: SigningComponentDefinition[]) => void;
  resolve: (kind: SigningComponentKind, name: string) => number | undefined;
  resolveOrThrow: (kind: SigningComponentKind, name: string) => number;
  reverseResolve: (
    kind: SigningComponentKind,
    code: number,
  ) => string | undefined;
  has: (kind: SigningComponentKind, name: string) => boolean;
  list: (kind?: SigningComponentKind) => SigningComponentDefinition[];
  reset: () => void;
};

export function createSigningComponentRegistry(): SigningComponentRegistry {
  const nameToCode = createNameMaps();
  const codeToName = createCodeMaps();

  const checkConflict = (
    stagedNameToCode: SigningComponentDefinitionMap,
    stagedCodeToName: SigningComponentReverseDefinitionMap,
    def: SigningComponentDefinition,
  ) => {
    const existingCode = stagedNameToCode[def.kind].get(def.name);
    if (existingCode !== undefined && existingCode !== def.code) {
      throw new SigningComponentConflictError(
        `Signing component conflict for ${def.kind}:${def.name}. Existing code=${existingCode}, new code=${def.code}.`,
        def,
      );
    }

    const existingName = stagedCodeToName[def.kind].get(def.code);
    if (existingName !== undefined && existingName !== def.name) {
      throw new SigningComponentConflictError(
        `Signing component conflict for ${def.kind} code=${def.code}. Existing name=${existingName}, new name=${def.name}.`,
        def,
      );
    }
  };

  const preflight = (definitions: SigningComponentDefinition[]) => {
    const normalized = normalizeDefinitions(definitions);
    const stagedNameToCode = createNameMaps();
    const stagedCodeToName = createCodeMaps();

    for (const kind of SIGNING_COMPONENT_KINDS) {
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

  const register = (definitions: SigningComponentDefinition[]) => {
    const normalized = normalizeDefinitions(definitions);
    preflight(normalized);

    for (const def of normalized) {
      nameToCode[def.kind].set(def.name, def.code);
      codeToName[def.kind].set(def.code, def.name);
    }
  };

  const resolve = (
    kind: SigningComponentKind,
    name: string,
  ): number | undefined => {
    return nameToCode[kind].get(normalizeSigningComponentName(name));
  };

  const resolveOrThrow = (kind: SigningComponentKind, name: string): number => {
    const code = resolve(kind, name);
    if (code === undefined) {
      throw new Error(`Signing component not found: ${kind}:${name}`);
    }
    return code;
  };

  const reverseResolve = (
    kind: SigningComponentKind,
    code: number,
  ): string | undefined => {
    return codeToName[kind].get(normalizeSigningComponentCode(code));
  };

  const has = (kind: SigningComponentKind, name: string): boolean => {
    return resolve(kind, name) !== undefined;
  };

  const list = (kind?: SigningComponentKind): SigningComponentDefinition[] => {
    const definitions: SigningComponentDefinition[] = [];
    const kinds = kind ? [kind] : SIGNING_COMPONENT_KINDS;

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
    for (const kind of SIGNING_COMPONENT_KINDS) {
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
