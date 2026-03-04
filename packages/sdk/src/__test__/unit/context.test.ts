import { createDeviceContext } from '../../chains/context';
import { resetSigningComponentRegistry } from '../../chains/signingComponents';

describe('chain context signing component resolution', () => {
  afterEach(() => {
    resetSigningComponentRegistry();
  });

  test('resolveSigningComponent resolves seeded builtins', () => {
    const context = createDeviceContext();
    expect(context.resolveSigningComponent('hash', 'KECCAK256')).toBeDefined();
    expect(context.resolveSigningComponent('curve', 'SECP256K1')).toBeDefined();
    expect(context.resolveSigningComponent('encoding', 'EVM')).toBeDefined();
  });

  test('resolveSigningComponent throws for unknown signing component', () => {
    const context = createDeviceContext();
    expect(() =>
      context.resolveSigningComponent('encoding', 'UNKNOWN_CHAIN'),
    ).toThrow('Signing component not found');
  });
});
