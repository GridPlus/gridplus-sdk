import {
  PrimitiveConflictError,
  createPrimitiveRegistry,
  type PrimitiveDefinition,
} from '@gridplus/chain-core';

describe('primitive registry core', () => {
  test('registers and resolves by name and code', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.reverseResolve('hash', 2)).toBe('SHA256');
    expect(registry.has('hash', 'SHA256')).toBe(true);
  });

  test('ignores exact duplicates', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.list('hash')).toHaveLength(1);
  });

  test('throws on name collision', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(() =>
      registry.register([{ kind: 'hash', name: 'SHA256', code: 99 }]),
    ).toThrow(PrimitiveConflictError);
  });

  test('throws on code collision', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(() =>
      registry.register([{ kind: 'hash', name: 'BLAKE2B', code: 2 }]),
    ).toThrow(PrimitiveConflictError);
  });

  test('namespaces collisions by kind', () => {
    const registry = createPrimitiveRegistry();
    registry.register([
      { kind: 'hash', name: 'SHA256', code: 2 },
      { kind: 'encoding', name: 'SHA256', code: 2 },
    ]);

    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.resolve('encoding', 'SHA256')).toBe(2);
  });

  test('preflight catches conflicts without mutation', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(() =>
      registry.preflight([{ kind: 'hash', name: 'SHA256', code: 77 }]),
    ).toThrow(PrimitiveConflictError);
    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.resolve('hash', 'BLAKE2B')).toBeUndefined();
  });

  test('register is atomic for a batch', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    const batch: PrimitiveDefinition[] = [
      { kind: 'hash', name: 'BLAKE2B', code: 4 },
      { kind: 'hash', name: 'SHA256', code: 99 },
    ];

    expect(() => registry.register(batch)).toThrow(PrimitiveConflictError);
    expect(registry.resolve('hash', 'BLAKE2B')).toBeUndefined();
  });

  test('resolveOrThrow throws for missing primitive', () => {
    const registry = createPrimitiveRegistry();
    expect(() => registry.resolveOrThrow('hash', 'MISSING')).toThrow(
      'Primitive not found',
    );
  });

  test('reset clears registered mappings', () => {
    const registry = createPrimitiveRegistry();
    registry.register([{ kind: 'curve', name: 'SECP256K1', code: 0 }]);
    registry.reset();

    expect(registry.resolve('curve', 'SECP256K1')).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });
});
