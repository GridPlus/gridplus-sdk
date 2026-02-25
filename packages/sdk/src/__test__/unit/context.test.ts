import { createDeviceContext } from '../../chains/context';
import { resetPrimitiveRegistry } from '../../chains/primitives';

describe('chain context primitive resolution', () => {
  afterEach(() => {
    resetPrimitiveRegistry();
  });

  test('resolvePrimitive resolves seeded builtins', () => {
    const context = createDeviceContext();
    expect(context.resolvePrimitive('hash', 'KECCAK256')).toBeDefined();
    expect(context.resolvePrimitive('curve', 'SECP256K1')).toBeDefined();
    expect(context.resolvePrimitive('encoding', 'EVM')).toBeDefined();
  });

  test('resolvePrimitive throws for unknown primitive', () => {
    const context = createDeviceContext();
    expect(() => context.resolvePrimitive('encoding', 'UNKNOWN_CHAIN')).toThrow(
      'Primitive not found',
    );
  });
});
