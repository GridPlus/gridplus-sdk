import { BigNumber, Contract } from 'ethers';

import { Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import dotenv from 'dotenv';
import { question } from 'readline-sync';
import { encode as rlpEncode } from 'rlp';
import { pair, sign, signMessage } from '../..';
import Counter from '../../../forge/out/Counter.sol/Counter.json';
import NegativeAmountHandler from '../../../forge/out/NegativeAmountHandler.sol/NegativeAmountHandler.json';
import { setupClient } from '../utils/setup';
import { parseUnits } from 'ethers/lib/utils';
import { JsonRpcProvider } from '@ethersproject/providers';
dotenv.config();

const WALLET_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

describe('NegativeAmountHandler', async () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test('handle negative amount', async () => {
    const provider = new JsonRpcProvider('http://localhost:8545');
    const contractAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
    const negativeAmountHandler = new Contract(
      contractAddress,
      NegativeAmountHandler.abi,
      provider,
    );

    const domain = {
      name: 'NegativeAmountHandler',
      version: '1',
      chainId: 31337,
      verifyingContract: contractAddress,
    };

    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Payment: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'int256' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const payment = {
      to: contractAddress, // Specify recipient address
      amount: BigNumber.from(-1000), // Negative amount for testing
      nonce: await provider.getTransactionCount(WALLET_ADDRESS, 'latest'),
    };
    const signature = await signMessage({
      domain,
      types,
      primaryType: 'Payment',
      message: payment,
    });

    // Encode the payment data
    const data = negativeAmountHandler.interface.encodeFunctionData(
      'handlePayment',
      [payment, signature],
    );

    // Create transaction request
    const txRequest = {
      to: contractAddress,
      from: WALLET_ADDRESS,
      data,
      nonce: await provider.getTransactionCount(WALLET_ADDRESS, 'latest'),
      gasLimit: 100000,
      gasPrice: parseUnits('10', 'gwei'),
    };

    const common = Common.custom(
      { chainId: 31337 },
      { hardfork: Hardfork.London },
    );
    const tx = TransactionFactory.fromTxData(txRequest, { common });
    const payload = rlpEncode(tx.getMessageToSign(false));

    const signedTx = await sign(payload);

    const v = `0x${Buffer.from(signedTx.sig.v).toString('hex')}`;
    const r = `0x${Buffer.from(signedTx.sig.r).toString('hex')}`;
    const s = `0x${Buffer.from(signedTx.sig.s).toString('hex')}`;

    const txToBroadcast = TransactionFactory.fromTxData(
      {
        ...txRequest,
        v,
        r,
        s,
      },
      { common },
    );

    const signedTxPayload = txToBroadcast.serialize();

    // Broadcast the signed transaction
    const txResponse = await provider.broadcastTransaction(
      `0x${signedTxPayload.toString('hex')}`,
    );
    const receipt = await txResponse.wait();

    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  });

  test('increment', async () => {
    const provider = new JsonRpcProvider('http://localhost:8545');
    const counter = new Contract(
      '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      Counter.abi,
      provider,
    );

    const txRequest = {
      to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      data: counter.interface.encodeFunctionData('increment'),
      nonce: await provider.getTransactionCount(
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        'latest',
      ),
      gasLimit: 100000,
      gasPrice: parseUnits('10', 'gwei'),
    };

    const common = Common.custom(
      { chainId: 31337 },
      { hardfork: Hardfork.London },
    );
    const tx = TransactionFactory.fromTxData(txRequest, { common });
    const payload = rlpEncode(tx.getMessageToSign(false));

    const signedTx = await sign(payload);

    const v = `0x${Buffer.from(signedTx.sig.v).toString('hex')}`;
    const r = `0x${Buffer.from(signedTx.sig.r).toString('hex')}`;
    const s = `0x${Buffer.from(signedTx.sig.s).toString('hex')}`;

    const txToBroadcast = TransactionFactory.fromTxData(
      {
        ...txRequest,
        v,
        r,
        s,
      },
      { common },
    );

    const signedTxPayload = txToBroadcast.serialize();

    // Broadcast the signed transaction
    const txResponse = await provider.broadcastTransaction(
      `0x${signedTxPayload.toString('hex')}`,
    );
    const receipt = await txResponse.wait();

    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  });
});
