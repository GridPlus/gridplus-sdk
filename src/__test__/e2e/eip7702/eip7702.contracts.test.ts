import * as dotenv from 'dotenv';
import { question } from 'readline-sync';
import {
  Account,
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  http,
  isAddress,
  parseEther,
  PublicClient,
  SendTransactionParameters,
  Transport,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { pair, signAuthorization, signAuthorizationList } from '../../../api';
import { deployContract } from '../../utils/contracts';
import { setupClient } from '../../utils/setup';
// @ts-ignore
import Simple7702Account from './abi/Simple7702Account.json';

dotenv.config();

const ETH_PROVIDER_URL = 'http://localhost:8545';
const WALLET_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('Simple7702Account EIP-7702 Flow', () => {
  let delegateContractAddress: Address;
  let chainId: number;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let account: Account;
  let simple7702Abi: any;

  beforeAll(async () => {
    // Deploy and verify delegate contract
    delegateContractAddress = (await deployContract(
      'Simple7702Account',
    )) as Address;
    console.log('Delegate contract deployed at:', delegateContractAddress);
    if (!delegateContractAddress || !isAddress(delegateContractAddress)) {
      throw new Error(
        `Invalid delegate contract address: ${delegateContractAddress}`,
      );
    }

    account = privateKeyToAccount(WALLET_PRIVATE_KEY as `0x${string}`);
    simple7702Abi = Simple7702Account.abi;

    const transport = http(ETH_PROVIDER_URL);
    publicClient = createPublicClient({
      chain: foundry,
      transport: transport as Transport,
    }) as PublicClient;
    walletClient = createWalletClient({
      chain: foundry,
      transport: transport as Transport,
      account,
    }) as WalletClient;
    chainId = await publicClient.getChainId();
    console.log('EOA Address:', account.address);
    console.log('Chain ID:', chainId);

    // Fund the account generously IF NEEDED
    const deployer = privateKeyToAccount(WALLET_PRIVATE_KEY as `0x${string}`);
    const deployerClient = createWalletClient({
      chain: foundry,
      transport: transport as Transport,
      account: deployer,
    });
    const minRequiredBalance = parseEther('1.0');
    const initialEoaBalance = await publicClient.getBalance({
      address: account.address,
    });
    if (initialEoaBalance < minRequiredBalance) {
      const amountToFund =
        minRequiredBalance + parseEther('0.5') - initialEoaBalance;
      const fundingTx = {
        account: deployer,
        to: account.address,
        value: amountToFund,
        chain: foundry,
      } satisfies Omit<SendTransactionParameters, 'kzg'>;
      const fundingHash = await deployerClient.sendTransaction(fundingTx);
      await publicClient.waitForTransactionReceipt({ hash: fundingHash });
      console.log(
        `Funded account ${account.address} with ${formatEther(amountToFund)} ETH`,
      );
    } else {
      console.log(
        `EOA ${account.address} already has sufficient funds: ${formatEther(initialEoaBalance)} ETH`,
      );
    }
    const fundedEoaBalance = await publicClient.getBalance({
      address: account.address,
    });
    expect(fundedEoaBalance).toBeGreaterThanOrEqual(minRequiredBalance);

    // Verify contract deployment
    const bytecode = await publicClient.getBytecode({
      address: delegateContractAddress,
    });
    expect(bytecode).toBeDefined();
    expect(bytecode!.length).toBeGreaterThan(2);
  }, 20000);

  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test.skip('Execute batch transactions with EIP-7702', async () => {
    expect(delegateContractAddress).toBeDefined();
    expect(isAddress(delegateContractAddress)).toBe(true);

    const recipient1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const recipient2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const value1 = parseEther('0.01');
    const value2 = parseEther('0.02');
    const totalValue = value1 + value2;

    // Get initial balances
    const initialEoaBalance_Test = await publicClient.getBalance({
      address: account.address,
    });
    const initialBalance1 = await publicClient.getBalance({
      address: recipient1,
    });
    const initialBalance2 = await publicClient.getBalance({
      address: recipient2,
    });
    expect(initialEoaBalance_Test).toBeGreaterThanOrEqual(totalValue);

    const authorization = await walletClient.signAuthorization({
      account,
      contractAddress: delegateContractAddress,
      chainId,
      executor: 'self',
    });
    // Log the nonce Viem used (it's part of the returned object)
    console.log(
      'EIP-7702 Authorization Signed (Viem derived nonce):',
      authorization,
    );

    // Prepare delegate call data
    const delegateCallData = encodeFunctionData({
      abi: simple7702Abi,
      functionName: 'executeBatch',
      args: [
        [
          { target: recipient1, value: value1, data: '0x' },
          { target: recipient2, value: value2, data: '0x' },
        ],
      ],
    });

    // Construct and send EIP-7702 transaction
    const gasLimit = 2_000_000n;
    const maxFee = parseEther('0.0000001');
    const maxPrio = parseEther('0.00000001');

    const eip7702Tx = {
      account,
      to: account.address,
      data: delegateCallData,
      value: 0n, // Keep value as 0, rely on pre-funded EOA
      type: 'eip7702' as const,
      authorizationList: [authorization], // Pass the full authorization object
      gas: gasLimit,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio,
      chain: foundry,
    } satisfies Omit<SendTransactionParameters, 'kzg'>;

    const hash = await walletClient.sendTransaction(eip7702Tx);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    expect(receipt.status).toBe('success');

    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

    // Get final balances
    const finalEoaBalance_Test = await publicClient.getBalance({
      address: account.address,
    });
    const finalBalance1 = await publicClient.getBalance({
      address: recipient1,
    });
    const finalBalance2 = await publicClient.getBalance({
      address: recipient2,
    });

    // --- Assert Balance Changes ---
    expect(finalEoaBalance_Test).toBe(
      initialEoaBalance_Test - totalValue - gasCost,
    );
    expect(finalBalance1).toBe(initialBalance1 + value1);
    expect(finalBalance2).toBe(initialBalance2 + value2);
  }, 30000);

  test('Execute batch transactions with EIP-7702 sign with lattice', async () => {
    expect(delegateContractAddress).toBeDefined();
    expect(isAddress(delegateContractAddress)).toBe(true);

    const recipient1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const recipient2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const value1 = parseEther('0.01');
    const value2 = parseEther('0.02');
    const totalValue = value1 + value2;

    console.log('Test values:');
    console.log('value1:', formatEther(value1), 'ETH');
    console.log('value2:', formatEther(value2), 'ETH');
    console.log('totalValue:', formatEther(totalValue), 'ETH');

    // Get initial balances
    const initialEoaBalance_Test = await publicClient.getBalance({
      address: account.address,
    });
    const initialBalance1 = await publicClient.getBalance({
      address: recipient1,
    });
    const initialBalance2 = await publicClient.getBalance({
      address: recipient2,
    });
    console.log('Initial balances:');
    console.log('EOA:       ', formatEther(initialEoaBalance_Test), 'ETH');
    console.log('recipient1:', formatEther(initialBalance1), 'ETH');
    console.log('recipient2:', formatEther(initialBalance2), 'ETH');
    expect(initialEoaBalance_Test).toBeGreaterThanOrEqual(totalValue); // Ensure EOA can cover transfers
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
    });

    const authTxPayload = {
      address: delegateContractAddress,
      chainId,
      nonce,
    };
    console.log('AuthTxPayload:', authTxPayload);
    // --- Let Viem handle nonce when executor is 'self' ---
    const authorization = await signAuthorization(authTxPayload);
    // Log the nonce Viem used (it's part of the returned object)
    console.log('EIP-7702 Authorization Signed By Lattice', authorization);

    // Prepare delegate call data
    const delegateCallData = encodeFunctionData({
      abi: simple7702Abi,
      functionName: 'executeBatch',
      args: [
        [
          { target: recipient1, value: value1, data: '0x' },
          { target: recipient2, value: value2, data: '0x' },
        ],
      ],
    });

    // Construct and send EIP-7702 transaction
    const gasLimit = 2_000_000n;
    const maxFee = parseEther('0.0000001');
    const maxPrio = parseEther('0.00000001');

    const eip7702Tx = {
      account,
      to: account.address,
      data: delegateCallData,
      chainId,
      nonce: await publicClient.getTransactionCount({
        address: account.address,
      }),
      value: 0n, // Keep value as 0, rely on pre-funded EOA
      type: 'eip7702' as const,
      authorizationList: [
        {
          chainId: authorization.chainId,
          address: authorization.address,
          nonce: authorization.nonce,
          yParity: authorization.yParity,
          r: authorization.r,
          s: authorization.s,
        },
      ], // Pass the full authorization object
      gas: gasLimit,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio,
      chain: foundry,
    } satisfies Omit<SendTransactionParameters, 'kzg'>;

    console.log('Sending EIP-7702 transaction with value=0 & derived nonce...');
    const response = await signAuthorizationList(eip7702Tx);

    // Prepare the transaction with proper signature components
    const signedTx = {
      to: eip7702Tx.to,
      data: eip7702Tx.data,
      value: eip7702Tx.value,
      gas: eip7702Tx.gas,
      maxFeePerGas: eip7702Tx.maxFeePerGas,
      maxPriorityFeePerGas: eip7702Tx.maxPriorityFeePerGas,
      type: 'eip7702' as const,
      chainId,
      authorizationList: eip7702Tx.authorizationList,
      yParity: response.sig.v % 2,
      r: `0x${response.sig.r.toString('hex')}`,
      s: `0x${response.sig.s.toString('hex')}`,
    };

    // Send the signed transaction
    const hash = await walletClient.sendTransaction(signedTx);
    console.log('Transaction hash:', hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Transaction receipt:', receipt);
    expect(receipt.status).toBe('success');

    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
    console.log('Gas Cost:', formatEther(gasCost), 'ETH');

    // Get final balances
    const finalEoaBalance_Test = await publicClient.getBalance({
      address: account.address,
    });
    const finalBalance1 = await publicClient.getBalance({
      address: recipient1,
    });
    const finalBalance2 = await publicClient.getBalance({
      address: recipient2,
    });
    console.log('Final balances:');
    console.log('EOA:       ', formatEther(finalEoaBalance_Test), 'ETH');
    console.log('recipient1:', formatEther(finalBalance1), 'ETH');
    console.log('recipient2:', formatEther(finalBalance2), 'ETH');

    // --- Assert Balance Changes ---
    expect(finalEoaBalance_Test).toBe(
      initialEoaBalance_Test - totalValue - gasCost,
    );
    expect(finalBalance1).toBe(initialBalance1 + value1);
    expect(finalBalance2).toBe(initialBalance2 + value2);
  }, 30000);
});
