import * as dotenv from 'dotenv';
import { BigNumber, Contract, Wallet, providers } from 'ethers';
import { joinSignature } from 'ethers/lib/utils';
import { question } from 'readline-sync';
import { pair, signMessage } from '../..';
import NegativeAmountHandler from '../../../forge/out/NegativeAmountHandler.sol/NegativeAmountHandler.json';
import { deployContract } from '../utils/contracts';
import { setupClient } from '../utils/setup';

dotenv.config();

const ETH_PROVIDER_URL = 'http://localhost:8545';
const WALLET_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('NegativeAmountHandler', () => {
  let contract: Contract;
  let wallet: Wallet;
  let CONTRACT_ADDRESS: string;
  let chainId: number;
  let domain;
  let data;
  let types;

  beforeAll(async () => {
    CONTRACT_ADDRESS = await deployContract('NegativeAmountHandler');

    const provider = new providers.JsonRpcProvider(ETH_PROVIDER_URL);
    chainId = (await provider.getNetwork()).chainId;
    wallet = new Wallet(WALLET_PRIVATE_KEY, provider);

    contract = new Contract(
      CONTRACT_ADDRESS,
      NegativeAmountHandler.abi,
      wallet,
    );

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
     * Sign the contract with Ethers
     */
    const ethersSignature = await wallet._signTypedData(domain, types, data);
    const ethersTx = await contract.verify(data, ethersSignature, {
      gasLimit: 100000,
    });
    expect(ethersTx).toBeTruthy();

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
    const r = `0x${response.sig.r.toString('hex')}`;
    const s = `0x${response.sig.s.toString('hex')}`;
    const v = BigNumber.from(response.sig.v).toNumber();
    const latticeSignature = joinSignature({ r, s, v });

    expect(latticeSignature).toEqual(ethersSignature);

    const tx = await contract.verify(data, latticeSignature, {
      gasLimit: 100000,
    });

    expect(tx).toBeTruthy();
  });
});
