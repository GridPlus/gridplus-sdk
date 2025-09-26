import * as dotenv from 'dotenv';
import { question } from 'readline-sync';
import { pair, signMessage } from '../..';
import { deployContract } from '../utils/contracts';
import { setupClient } from '../utils/clientStorage';
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
// @ts-ignore
import NegativeAmountHandler from '../../../forge/out/NegativeAmountHandler.sol/NegativeAmountHandler.json';

dotenv.config();

const ETH_PROVIDER_URL = 'http://localhost:8545';
const WALLET_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('NegativeAmountHandler', () => {
  let CONTRACT_ADDRESS: Address;
  let chainId: number;
  let domain;
  let data;
  let types;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let account: Account;
  let contract;

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

    contract = getContract({
      address: CONTRACT_ADDRESS,
      abi: NegativeAmountHandler.abi,
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
    const latticeSignature = `0x${response.sig.r.toString('hex')}${response.sig.s.toString('hex')}${response.sig.v.toString('hex').padStart(2, '0')}`;

    expect(latticeSignature).toEqual(viemSignature);

    const tx = await contract.write.verify([data, latticeSignature], {
      gas: BigInt(100000),
    });

    expect(tx).toBeTruthy();
  });
});
