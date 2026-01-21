import {
  type MessageTypes,
  SignTypedDataVersion,
  TypedDataUtils,
  type TypedMessage,
} from '@metamask/eth-sig-util';
import { ecsign, privateToAddress } from 'ethereumjs-util';
import { mnemonicToAccount } from 'viem/accounts';
import { HARDENED_OFFSET } from '../../constants';
import ethereum from '../../ethereum';
import { DEFAULT_SIGNER, buildFirmwareConstants } from '../utils/builders';
import { TEST_MNEMONIC } from '../utils/testConstants';

const typedData: TypedMessage<MessageTypes> = {
  types: {
    EIP712Domain: [{ name: 'chainId', type: 'uint256' }],
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
    born: 2015,
  },
};

describe('validateEthereumMsgResponse', () => {
  it('recovers expected signature for EIP712 payload', () => {
    const account = mnemonicToAccount(TEST_MNEMONIC);
    const priv = Buffer.from(account.getHdKey().privateKey!);
    const signer = privateToAddress(priv);
    const digest = TypedDataUtils.eip712Hash(
      typedData,
      SignTypedDataVersion.V4,
    );
    const sig = ecsign(Buffer.from(digest), priv);
    const fwConstants = buildFirmwareConstants();
    const request = ethereum.buildEthereumMsgRequest({
      signerPath: DEFAULT_SIGNER,
      protocol: 'eip712',
      payload: JSON.parse(JSON.stringify(typedData)),
      fwConstants,
    });
    const result = ethereum.validateEthereumMsgResponse(
      {
        signer: `0x${signer.toString('hex')}`,
        sig: { r: Buffer.from(sig.r), s: Buffer.from(sig.s) },
      },
      request,
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

    const account = mnemonicToAccount(TEST_MNEMONIC);
    const priv = Buffer.from(account.getHdKey().privateKey!);
    const signer = privateToAddress(priv);
    const digest = TypedDataUtils.eip712Hash(
      typedData,
      SignTypedDataVersion.V4,
    );
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
