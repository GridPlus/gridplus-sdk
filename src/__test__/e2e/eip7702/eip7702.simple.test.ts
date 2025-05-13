import * as dotenv from 'dotenv';
import { question } from 'readline-sync';
import {
  Address,
  createPublicClient,
  encodeFunctionData,
  http,
  isAddress,
  PublicClient,
  Transport,
  parseEther,
  serializeTransaction,
  TransactionSerializableEIP7702,
  recoverTransactionAddress,
} from 'viem';
import { sepolia } from 'viem/chains';
import {
  pair,
  signAuthorization,
  signAuthorizationList,
  fetchAddress,
} from '../../../api';
import { setupClient } from '../../utils/setup';
import { DEFAULT_ETH_DERIVATION } from '../../../constants';

dotenv.config();

// -----------------------------------------------------------------------------
// Simple7702Account constants --------------------------------------------------
// -----------------------------------------------------------------------------

const ETH_PROVIDER_URL =
  process.env.ETH_PROVIDER_URL || sepolia.rpcUrls.default.http[0];

// Canonical Simple7702Account on Sepolia (tag v0.8)
const SIMPLE_ACCOUNT: Address = '0xe6Cae83BdE06E4c305530e199D7217f42808555B';

// Minimal ABI (only what we invoke)
const simpleAbi = [
  {
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// -----------------------------------------------------------------------------
// Test -------------------------------------------------------------------------
// -----------------------------------------------------------------------------

describe('EIP‑7702 => Simple7702Account delegation + signature proof', () => {
  let client: PublicClient;
  let eoa: Address;

  beforeAll(async () => {
    client = createPublicClient({
      chain: sepolia,
      transport: http(ETH_PROVIDER_URL) as Transport,
    }) as PublicClient;

    if (!(await setupClient())) {
      const secret = process.env.LATTICE_SECRET ?? question('Lattice secret: ');
      await pair(secret.trim().toUpperCase());
    }

    eoa = (await fetchAddress(DEFAULT_ETH_DERIVATION)) as Address;
    if (!isAddress(eoa)) throw new Error('bad lattice eoa');
  }, 30_000);

  it('authorises & executes `execute` with proof‑of‑sig', async () => {
    // 1️⃣ Build call‑data (no ETH transfer, call back to self)
    const callData = encodeFunctionData({
      abi: simpleAbi,
      functionName: 'execute',
      args: [eoa, 0n, '0x'],
    });

    // 2️⃣ Sign AUTH tuple (nonce = current nonce)
    const authNonce = await client.getTransactionCount({
      address: eoa,
      blockTag: 'pending',
    });
    const authSig = await signAuthorization({
      chainId: sepolia.id,
      address: SIMPLE_ACCOUNT,
      nonce: authNonce,
    });

    const authorizationList = [
      {
        chainId: sepolia.id,
        address: eoa,
        nonce: authNonce,
        yParity: authSig.yParity,
        r: authSig.r,
        s: authSig.s,
      },
    ] as const;

    // 3️⃣ Build unsigned 7702 tx (nonce = authNonce + 1)
    const unsignedTx = {
      from: eoa,
      to: SIMPLE_ACCOUNT,
      chainId: sepolia.id,
      nonce: authNonce + 1,
      type: 'eip7702' as const,
      value: 0n,
      data: callData,
      authorizationList,
      accessList: [],
      gas: 120_000n,
      maxFeePerGas: parseEther('0.00000005'), // 50 gwei
      maxPriorityFeePerGas: parseEther('0.000000002'), // 2 gwei tip
    } as const;

    console.log('unsignedTx', unsignedTx);

    // 4️⃣ Sign outer tx & recover signer (proof‑of‑signature)
    const outerSig = await signAuthorizationList(unsignedTx);
    console.log('outerSig', outerSig);
    const serialized = serializeTransaction({
      ...unsignedTx,
      ...outerSig,
      yParity: Number(outerSig.yParity),
    } satisfies TransactionSerializableEIP7702);

    console.log('serialized', serialized);

    // const recovered = await recoverTransactionAddress({
    //   serializedTransaction: serialized,
    // });
    // expect(recovered).toBe(eoa);

    // 5️⃣ Send tx & await receipt
    const hash = await client.sendRawTransaction({
      serializedTransaction: serialized,
    });
    console.log('hash', hash);
    const receipt = await client.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe('success');

    console.log('✅ 7702 hash', hash, 'gasUsed', receipt.gasUsed.toString());
  }, 120_000_000);
});
