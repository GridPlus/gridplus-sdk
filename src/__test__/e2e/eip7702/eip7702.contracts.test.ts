import * as dotenv from 'dotenv';
import { question } from 'readline-sync';
import {
  Address,
  createPublicClient,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters, // We'll use this
  formatEther,
  http,
  isAddress,
  parseEther,
  PublicClient,
  Transport,
  serializeTransaction,
  TransactionSerializableEIP7702,
  Hex,
} from 'viem';
import { sepolia } from 'viem/chains';
import { pair, signAuthorizationList } from '../../../api';
import { setupClient } from '../../utils/setup';
import { DEFAULT_ETH_DERIVATION } from '../../../constants';

import DeleGatorABI_JSON from './abi/EIP7702StatelessDeleGator.json'; // Your ABI file

import { fetchAddress } from '../../../api';

dotenv.config();

const ETH_PROVIDER_URL =
  process.env.ETH_PROVIDER_URL || sepolia.rpcUrls.default.http[0];
const PRE_DEPLOYED_DELEGATOR_ADDRESS: Address =
  '0x6eb81ea5bc15f4f4a2d79fa15a75a43c1ee17cd0'; // Corrected checksum

// This string defines a single parameter type: an array of our Execution struct.
// We give the parameter a name "_executionBatch" for `parseAbiParameters`.
const executionBatchParameterDefinition =
  'tuple(address target, uint256 value, bytes callData)[] _executionBatch';

describe('EIP7702StatelessDeleGator EIP-7702 Flow with Lattice', () => {
  let delegatorContractAddress: Address;
  let chainId: number;
  let publicClient: PublicClient;
  let delegatorAbi: any;
  let latticeAddress: Address;

  beforeAll(async () => {
    const transport = http(ETH_PROVIDER_URL);
    publicClient = createPublicClient({
      chain: sepolia,
      transport: transport as Transport,
    }) as PublicClient;

    chainId = await publicClient.getChainId();
    if (chainId !== sepolia.id) {
      throw new Error(
        `Chain ID mismatch. Expected ${sepolia.id}, got ${chainId}.`,
      );
    }
    console.log('Chain ID:', chainId);

    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Lattice not paired. Enter secret: ');
      if (!secret) throw new Error('Pairing secret required.');
      await pair(secret.toUpperCase());
    }

    latticeAddress = (await fetchAddress(DEFAULT_ETH_DERIVATION)) as Address;
    if (!isAddress(latticeAddress)) {
      throw new Error(`Invalid Lattice address: ${latticeAddress}`);
    }
    console.log('Lattice EOA Address:', latticeAddress);

    const balance = await publicClient.getBalance({ address: latticeAddress });
    console.log(`Lattice account balance: ${formatEther(balance)} ETH`);
    if (balance < parseEther('0.01')) {
      console.warn(
        'Lattice account balance is low. Ensure sufficient funds for fees.',
      );
    }

    delegatorContractAddress = PRE_DEPLOYED_DELEGATOR_ADDRESS;
    console.log(
      'Using pre-deployed EIP7702StatelessDeleGator at:',
      delegatorContractAddress,
    );
    if (!isAddress(delegatorContractAddress)) {
      throw new Error(
        `Invalid pre-deployed contract address: ${delegatorContractAddress}`,
      );
    }

    const bytecode = await publicClient.getBytecode({
      address: delegatorContractAddress,
    });
    if (!bytecode || bytecode === '0x') {
      console.warn(
        `No bytecode at ${delegatorContractAddress}. Ensure contract is deployed.`,
      );
    } else {
      console.log(`Bytecode found at ${delegatorContractAddress}.`);
    }

    delegatorAbi = DeleGatorABI_JSON.abi;
    if (!Array.isArray(delegatorAbi)) {
      throw new Error(
        'Failed to load delegator ABI correctly. `DeleGatorABI_JSON.abi` is not an array.',
      );
    }
  }, 60000);

  test('Execute batch ETH transfers via EIP7702StatelessDeleGator', async () => {
    expect(isAddress(delegatorContractAddress)).toBe(true);
    expect(isAddress(latticeAddress)).toBe(true);

    const recipient1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const recipient2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const value1 = parseEther('0.00001');
    const value2 = parseEther('0.00002');
    const totalValueForTx = value1 + value2;

    const initialEoaBalance = await publicClient.getBalance({
      address: latticeAddress,
    });
    const initialBalance1 = await publicClient.getBalance({
      address: recipient1 as Address,
    });
    const initialBalance2 = await publicClient.getBalance({
      address: recipient2 as Address,
    });
    console.log(
      `Initial Balances - EOA: ${formatEther(initialEoaBalance)}, R1: ${formatEther(initialBalance1)}, R2: ${formatEther(initialBalance2)}`,
    );

    if (initialEoaBalance < totalValueForTx + parseEther('0.001')) {
      throw new Error('Lattice EOA balance insufficient.');
    }

    const eoaNonce = await publicClient.getTransactionCount({
      address: latticeAddress,
      blockTag: 'pending',
    });
    console.log(`Using EOA nonce for EIP-7702 transaction: ${eoaNonce}`);

    const executionCalls = [
      { target: recipient1 as Address, value: value1, callData: '0x' as Hex },
      { target: recipient2 as Address, value: value2, callData: '0x' as Hex },
    ];

    // `parseAbiParameters` takes a string defining one or more parameters.
    // Here, `executionBatchParameterDefinition` defines ONE parameter of type `tuple(...)[]` named `_executionBatch`.
    // `encodeAbiParameters` then expects an array of values, one for each defined parameter.
    // Since we defined one parameter, we pass an array containing one value: `[executionCalls]`.
    const encodedExecutionCalldata = encodeAbiParameters(
      parseAbiParameters(executionBatchParameterDefinition),
      [executionCalls], // The value for the `_executionBatch` parameter
    );
    console.log(
      '_executionCalldata (encoded batch):',
      encodedExecutionCalldata,
    );

    const MODE_CODE_BATCH_REVERT_ON_FAILURE: Hex =
      '0x0100000000000000000000000000000000000000000000000000000000000000';
    console.log(
      'ModeCode for batch call (revert on failure):',
      MODE_CODE_BATCH_REVERT_ON_FAILURE,
    );

    const DELEGATOR_EXECUTE_FUNCTION_NAME = 'execute';
    const abiItem = delegatorAbi.find(
      (item: any) =>
        item.name === DELEGATOR_EXECUTE_FUNCTION_NAME &&
        item.type === 'function' &&
        item.inputs &&
        item.inputs.length === 2 &&
        item.inputs[0].type === 'bytes32' && // ModeCode
        item.inputs[1].type === 'bytes', // executionData
    );
    if (!abiItem) {
      throw new Error(
        `Function ${DELEGATOR_EXECUTE_FUNCTION_NAME}(bytes32,bytes) not found in ABI.`,
      );
    }

    const delegatorOuterCallData = encodeFunctionData({
      abi: delegatorAbi,
      functionName: DELEGATOR_EXECUTE_FUNCTION_NAME,
      args: [MODE_CODE_BATCH_REVERT_ON_FAILURE, encodedExecutionCalldata],
    });

    const gasLimit = BigInt(400000);
    const maxFee = parseEther('0.00000002');
    const maxPrio = parseEther('0.0000000015');

    const eip7702TxForLatticeSigning = {
      from: latticeAddress,
      to: delegatorContractAddress,
      data: delegatorOuterCallData,
      chainId: sepolia.id,
      nonce: await publicClient.getTransactionCount({
        address: latticeAddress,
        blockTag: 'pending',
      }),
      value: totalValueForTx,
      type: 'eip7702' as const,
      authorizationList: [],
      accessList: [],
      gas: gasLimit,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio,
    };

    console.log(
      'Preparing to sign EIP-7702 transaction to EIP7702StatelessDeleGator...',
    );
    const signedEip7702Tx = await signAuthorizationList(
      eip7702TxForLatticeSigning,
    );
    console.log('EIP-7702 Transaction signed by Lattice.');

    const eip7702TxToSerialize: TransactionSerializableEIP7702 = {
      chainId: eip7702TxForLatticeSigning.chainId,
      nonce: eip7702TxForLatticeSigning.nonce,
      gas: eip7702TxForLatticeSigning.gas,
      maxFeePerGas: eip7702TxForLatticeSigning.maxFeePerGas,
      maxPriorityFeePerGas: eip7702TxForLatticeSigning.maxPriorityFeePerGas,
      to: eip7702TxForLatticeSigning.to,
      value: eip7702TxForLatticeSigning.value,
      data: eip7702TxForLatticeSigning.data,
      accessList: eip7702TxForLatticeSigning.accessList,
      authorizationList: eip7702TxForLatticeSigning.authorizationList,
      type: 'eip7702',
      r: signedEip7702Tx.r,
      s: signedEip7702Tx.s,
      yParity: Number(signedEip7702Tx.yParity) as 0 | 1,
    };

    const serializedTransaction = serializeTransaction(eip7702TxToSerialize);

    console.log('Sending EIP-7702 transaction...');
    const hash = await publicClient.sendRawTransaction({
      serializedTransaction,
    });
    console.log(`Transaction hash: ${hash}. Waiting for receipt...`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Transaction receipt:', receipt);
    expect(receipt.status).toBe('success');

    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
    console.log('Actual Gas Cost:', formatEther(gasCost), 'ETH');

    const finalEoaBalance = await publicClient.getBalance({
      address: latticeAddress,
    });
    const finalBalance1 = await publicClient.getBalance({
      address: recipient1 as Address,
    });
    const finalBalance2 = await publicClient.getBalance({
      address: recipient2 as Address,
    });
    console.log(
      `Final Balances - EOA: ${formatEther(finalEoaBalance)}, R1: ${formatEther(finalBalance1)}, R2: ${formatEther(finalBalance2)}`,
    );

    expect(finalEoaBalance).toBe(initialEoaBalance - totalValueForTx - gasCost);
    expect(finalBalance1).toBe(initialBalance1 + value1);
    expect(finalBalance2).toBe(initialBalance2 + value2);
  }, 60000);
});
