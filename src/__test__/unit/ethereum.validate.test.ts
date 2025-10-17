import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { mnemonicToSeedSync } from 'bip39';
import bip32 from 'bip32';
import { ecsign, privateToAddress } from 'ethereumjs-util';
import ethereum from '../../ethereum';
import { buildFirmwareConstants, DEFAULT_SIGNER } from '../utils/builders';
import { HARDENED_OFFSET } from '../../constants';

const TEST_MNEMONIC =
  'nose elder baby marriage frequent list ' +
  'cargo swallow memory universe smooth involve ' +
  'iron purity throw vintage crew artefact ' +
  'pyramid dash split announce trend grain';

const typedData = {
  types: {
    EIP712Domain: [
      { name: 'chainId', type: 'uint256' },
    ],
    Greeting: [
      { name: 'salutation', type: 'string' },
      { name: 'target', type: 'string' },
      { name: 'born', type: 'int32' },
    ],
  },
  primaryType: 'Greeting',
  domain: { chainId: 1 },
  message: {
    salutation: 'Hello',
    target: 'Ethereum',
    born: '2015',
  },
};

describe('validateEthereumMsgResponse', () => {
  it('recovers expected signature for EIP712 payload', () => {
    const seed = mnemonicToSeedSync(TEST_MNEMONIC);
    const priv = bip32.fromSeed(seed).derivePath("m/44'/60'/0'/0/0").privateKey!;
    const signer = privateToAddress(priv);
    const digest = TypedDataUtils.eip712Hash(typedData, SignTypedDataVersion.V4);
    const sig = ecsign(Buffer.from(digest), priv);
    const result = ethereum.validateEthereumMsgResponse(
      {
        signer: `0x${signer.toString('hex')}`,
        sig: { r: Buffer.from(sig.r), s: Buffer.from(sig.s) },
      },
      {
        input: { protocol: 'eip712', payload: typedData },
        prehash: null,
      },
    );

    expect(result.v.toString('hex')).toBe('1c');
  });

  it('validates response using buildEthereumMsgRequest request context', () => {
    const fwConstants = buildFirmwareConstants();
    const signerPath = [...DEFAULT_SIGNER];
    signerPath[2] = HARDENED_OFFSET;

    const request = ethereum.buildEthereumMsgRequest({
      signerPath,
      protocol: 'eip712',
      payload: JSON.parse(JSON.stringify(typedData)),
      fwConstants,
    });

    const seed = mnemonicToSeedSync(TEST_MNEMONIC);
    const priv = bip32.fromSeed(seed).derivePath("m/44'/60'/0'/0/0").privateKey!;
    const signer = privateToAddress(priv);
    const digest = TypedDataUtils.eip712Hash(typedData, SignTypedDataVersion.V4);
    const sig = ecsign(Buffer.from(digest), priv);

    const result = ethereum.validateEthereumMsgResponse(
      {
        signer,
        sig: { r: Buffer.from(sig.r), s: Buffer.from(sig.s) },
      },
      request,
    );

    expect(result.v.toString('hex')).toBe('1c');
  });
});
