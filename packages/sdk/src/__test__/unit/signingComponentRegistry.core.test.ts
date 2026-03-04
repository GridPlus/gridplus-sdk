import {
  SigningComponentConflictError,
  createSigningComponentRegistry,
  type SigningComponentDefinition,
} from '@gridplus/chain-core';

describe('signing component registry core', () => {
  test('registers and resolves by name and code', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.reverseResolve('hash', 2)).toBe('SHA256');
    expect(registry.has('hash', 'SHA256')).toBe(true);
  });

  test('ignores exact duplicates', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.list('hash')).toHaveLength(1);
  });

  test('throws on name collision', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(() =>
      registry.register([{ kind: 'hash', name: 'SHA256', code: 99 }]),
    ).toThrow(SigningComponentConflictError);
  });

  test('throws on code collision', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(() =>
      registry.register([{ kind: 'hash', name: 'BLAKE2B', code: 2 }]),
    ).toThrow(SigningComponentConflictError);
  });

  test('namespaces collisions by kind', () => {
    const registry = createSigningComponentRegistry();
    registry.register([
      { kind: 'hash', name: 'SHA256', code: 2 },
      { kind: 'encoding', name: 'SHA256', code: 2 },
    ]);

    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.resolve('encoding', 'SHA256')).toBe(2);
  });

  test('preflight catches conflicts without mutation', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    expect(() =>
      registry.preflight([{ kind: 'hash', name: 'SHA256', code: 77 }]),
    ).toThrow(SigningComponentConflictError);
    expect(registry.resolve('hash', 'SHA256')).toBe(2);
    expect(registry.resolve('hash', 'BLAKE2B')).toBeUndefined();
  });

  test('register is atomic for a batch', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'hash', name: 'SHA256', code: 2 }]);

    const batch: SigningComponentDefinition[] = [
      { kind: 'hash', name: 'BLAKE2B', code: 4 },
      { kind: 'hash', name: 'SHA256', code: 99 },
    ];

    expect(() => registry.register(batch)).toThrow(
      SigningComponentConflictError,
    );
    expect(registry.resolve('hash', 'BLAKE2B')).toBeUndefined();
  });

  test('resolveOrThrow throws for missing signing component', () => {
    const registry = createSigningComponentRegistry();
    expect(() => registry.resolveOrThrow('hash', 'MISSING')).toThrow(
      'Signing component not found',
    );
  });

  test('reset clears registered mappings', () => {
    const registry = createSigningComponentRegistry();
    registry.register([{ kind: 'curve', name: 'SECP256K1', code: 0 }]);
    registry.reset();

    expect(registry.resolve('curve', 'SECP256K1')).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });
});
