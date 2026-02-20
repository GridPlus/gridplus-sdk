import type {
  Address,
  ChainPlugin,
  DerivationPath,
  DeviceContext,
  PublicKey,
  SignResult,
} from '@gridplus/chain-core';
import { BTC_COIN_TYPES, BTC_PURPOSES, HARDENED_OFFSET } from '../constants';
import { format } from '../slip132';
import type {
  BtcCoinType,
  BtcPurpose,
  XpubOptions,
  XpubsOptions,
} from '../types';
import {
  btc,
  type BtcAdapter,
  type BtcAdapterOptions,
  type BtcSignRequest,
  type Signer as BtcSigner,
} from '../chain';
import {
  compressSecp256k1Pubkey,
  normalizeBtcSignedTxHex,
  normalizeTxHashHex,
} from './shared';

type LatticeBtcContext = DeviceContext & {
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        SECP256K1_PUB: number;
        SECP256K1_XPUB: number;
      };
    };
    CURRENCIES: {
      BTC: string;
    };
  };
};

function getLatticeBtcConstants(
  context: DeviceContext,
): LatticeBtcContext['constants'] {
  const constants = context.constants as
    | LatticeBtcContext['constants']
    | undefined;
  if (!constants?.EXTERNAL?.GET_ADDR_FLAGS || !constants?.CURRENCIES?.BTC) {
    throw new Error(
      'Lattice BTC signer requires EXTERNAL and CURRENCIES constants',
    );
  }
  return constants;
}

export function createLatticeBtcSigner(context: DeviceContext): BtcSigner {
  const { queue } = context;
  const { EXTERNAL, CURRENCIES } = getLatticeBtcConstants(context);

  const getAddress = async (path: DerivationPath): Promise<Address> => {
    const res = (await queue((client: any) =>
      client.getAddresses({ startPath: path, n: 1 }),
    )) as any[];
    const addr = res?.[0];
    if (typeof addr !== 'string') {
      throw new Error('Device did not return a BTC address string');
    }
    return addr;
  };

  const getPublicKey = async (
    path: DerivationPath,
    options?: unknown,
  ): Promise<PublicKey> => {
    const res = (await queue((client: any) =>
      client.getAddresses({
        startPath: path,
        n: 1,
        flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
      }),
    )) as any[];
    const pub = res?.[0];
    if (!pub) throw new Error('Device did not return a public key');
    const pubBytes = Buffer.from(pub);
    const wantCompressed =
      typeof (options as any)?.compressed === 'boolean'
        ? Boolean((options as any).compressed)
        : false;
    return wantCompressed
      ? compressSecp256k1Pubkey(new Uint8Array(pubBytes))
      : new Uint8Array(pubBytes);
  };

  const sign = async (request: BtcSignRequest): Promise<SignResult> => {
    if (request.kind !== 'transaction') {
      throw new Error(`Unsupported BTC sign request kind: ${request.kind}`);
    }
    const res = await queue((client: any) =>
      client.sign({ data: request.payload as any, currency: CURRENCIES.BTC }),
    );
    return {
      signature: { bytes: new Uint8Array() },
      signedPayload: normalizeBtcSignedTxHex((res as any).tx),
      txHash: normalizeTxHashHex((res as any).txHash),
      metadata: {
        changeRecipient: (res as any).changeRecipient,
        sigs: (res as any).sigs,
      },
    };
  };

  const getXpub = async (options: XpubOptions): Promise<string> => {
    const { purpose, coinType = BTC_COIN_TYPES.MAINNET, account = 0 } = options;
    const startPath: DerivationPath = [
      purpose + HARDENED_OFFSET,
      coinType + HARDENED_OFFSET,
      account + HARDENED_OFFSET,
    ];
    const network = coinType === BTC_COIN_TYPES.TESTNET ? 'testnet' : 'mainnet';
    const res = (await queue((client: any) =>
      client.getAddresses({
        startPath,
        n: 1,
        flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_XPUB,
      }),
    )) as any[];
    const xpub = res?.[0];
    if (typeof xpub !== 'string') {
      throw new Error('Device did not return an xpub string');
    }
    return format(xpub, purpose, network);
  };

  const getXpubs = async (
    options: XpubsOptions,
  ): Promise<Map<BtcPurpose, string>> => {
    const {
      purposes,
      coinType = BTC_COIN_TYPES.MAINNET,
      account = 0,
    } = options;
    const results = new Map<BtcPurpose, string>();
    for (const purpose of purposes) {
      results.set(purpose, await getXpub({ purpose, coinType, account }));
    }
    return results;
  };

  const getAllXpubs = async (
    coinType: BtcCoinType = BTC_COIN_TYPES.MAINNET,
    account = 0,
  ): Promise<{ xpub: string; ypub: string; zpub: string }> => {
    const xpubs = await getXpubs({
      purposes: [
        BTC_PURPOSES.LEGACY,
        BTC_PURPOSES.WRAPPED,
        BTC_PURPOSES.NATIVE,
      ],
      coinType,
      account,
    });
    const xpub = xpubs.get(BTC_PURPOSES.LEGACY);
    const ypub = xpubs.get(BTC_PURPOSES.WRAPPED);
    const zpub = xpubs.get(BTC_PURPOSES.NATIVE);
    if (!xpub || !ypub || !zpub) {
      throw new Error('Failed to fetch all xpubs');
    }
    return { xpub, ypub, zpub };
  };

  return {
    getAddress,
    getPublicKey,
    sign,
    getXpub,
    getXpubs,
    getAllXpubs,
  };
}

export const latticePlugin: ChainPlugin<
  LatticeBtcContext,
  BtcSignRequest,
  BtcAdapter,
  BtcAdapterOptions,
  BtcSigner
> = {
  chainId: btc.id,
  device: 'lattice',
  module: btc,
  createSigner: createLatticeBtcSigner,
};
