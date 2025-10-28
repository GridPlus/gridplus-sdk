import * as dotenv from 'dotenv';
import { question } from 'readline-sync';
import { pair, signMessage } from '../..';
import { deployContract } from '../utils/contracts';
import { setupClient } from '../utils/setup';
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  Address,
  PublicClient,
  WalletClient,
  Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { readFileSync } from 'fs';
import path from 'path';
import { ensureHexBuffer } from '../../util';
import { execSync } from 'child_process';

dotenv.config();

const ETH_PROVIDER_URL = 'http://localhost:8545';
const WALLET_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const forgeAvailable = (() => {
  try {
    execSync('forge --version', { stdio: 'pipe' });
    return true;
  } catch (err) {
    console.warn(
      'Forge CLI not available; skipping NegativeAmountHandler tests:',
      (err as Error).message,
    );
    return false;
  }
})();

const describeContract = forgeAvailable ? describe : describe.skip;

describeContract('NegativeAmountHandler', () => {
  let CONTRACT_ADDRESS: Address;
  let chainId: number;
  let domain;
  let data;
  let types;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let account: Account;
  let contract;
  let abi: any[];

  beforeAll(async () => {
    CONTRACT_ADDRESS = (await deployContract(
      'NegativeAmountHandler',
    )) as Address;

    publicClient = createPublicClient({
      chain: foundry,
      transport: http(ETH_PROVIDER_URL),
    });

    account = privateKeyToAccount(WALLET_PRIVATE_KEY);
    walletClient = createWalletClient({
      chain: foundry,
      transport: http(ETH_PROVIDER_URL),
      account,
    });

    chainId = await publicClient.getChainId();

    const artifactPath = path.resolve(
      __dirname,
      '../../../forge/out/NegativeAmountHandler.sol/NegativeAmountHandler.json',
    );
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    abi = artifact.abi;

    contract = getContract({
      address: CONTRACT_ADDRESS,
      abi,
      client: {
        public: publicClient,
        wallet: walletClient,
      },
    });

    domain = {
      name: 'NegativeAmountHandler',
      version: '1',
      chainId,
      verifyingContract: CONTRACT_ADDRESS,
    };

    types = {
      Data: [
        { name: 'amount', type: 'int256' },
        { name: 'message', type: 'string' },
      ],
    };

    data = {
      amount: -100,
      message: 'Negative payment test',
    };
  });

  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test('Sign Negative Amount EIP712 Contract', async () => {
    /**
     * Sign the contract with viem
     */
    const viemSignature = await walletClient.signTypedData({
      domain,
      types,
      primaryType: 'Data',
      message: data,
    });

    const viemTx = await contract.write.verify([data, viemSignature], {
      gas: BigInt(100000),
    });
    expect(viemTx).toBeTruthy();

    /**
     * Sign the contract with Lattice
     */
    const _types = {
      ...types,
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    };

    const msg = {
      types: _types,
      domain,
      primaryType: 'Data',
      message: data,
    };

    const response = await signMessage(msg);

    const normalizeHex = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'bigint') {
        let hex = value.toString(16);
        if (hex.length % 2 !== 0) hex = `0${hex}`;
        return hex;
      }
      if (typeof value === 'number') {
        return value.toString(16);
      }
      if (typeof value === 'string') {
        return value.startsWith('0x') ? value.slice(2) : value;
      }
      if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return Buffer.from(value).toString('hex');
      }
      if (typeof value?.toString === 'function') {
        const str = value.toString();
        if (/^0x[0-9a-f]+$/i.test(str)) {
          return str.slice(2);
        }
        if (/^[0-9a-f]+$/i.test(str)) {
          return str;
        }
      }
      return ensureHexBuffer(value as string | number | Buffer).toString('hex');
    };

    const rHex = normalizeHex(response.sig.r);
    const sHex = normalizeHex(response.sig.s);
    let vHex = normalizeHex(response.sig.v);
    if (!vHex) {
      vHex = '00';
    }
    vHex = vHex.padStart(2, '0');

    const latticeSignature = `0x${rHex}${sHex}${vHex}`;

    expect(latticeSignature).toEqual(viemSignature);

    const tx = await contract.write.verify([data, latticeSignature], {
      gas: BigInt(100000),
    });

    expect(tx).toBeTruthy();
  });
});
