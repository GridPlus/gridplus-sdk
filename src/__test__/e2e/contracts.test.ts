import { BigNumber, Contract, ethers } from 'ethers';

import { Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import { JsonRpcProvider } from '@ethersproject/providers';
import dotenv from 'dotenv';
import { joinSignature, parseUnits } from 'ethers/lib/utils';
import { startsWith } from 'lodash';
import { question } from 'readline-sync';
import { encode as rlpEncode } from 'rlp';
import { pair, sign, signMessage } from '../..';
import Counter from '../../../forge/out/Counter.sol/Counter.json';
import NegativeAmountHandler from '../../../forge/out/NegativeAmountHandler.sol/NegativeAmountHandler.json';
import { setupClient } from '../utils/setup';
dotenv.config();

export const addHexPrefix = (value: string): string =>
  startsWith(value, '0x') ? value : `0x${value}`;

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
    const provider = new ethers.providers.JsonRpcProvider(
      'http://localhost:8545',
    );
    const contractAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
    const negativeAmountHandler = new ethers.Contract(
      contractAddress,
      NegativeAmountHandler.abi,
      provider,
    );

    const common = Common.custom(
      { chainId: 31337 },
      { hardfork: Hardfork.London },
    );

    const payment = {
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Specify recipient address
      amount: 100000000000,
      nonce: await provider.getTransactionCount(WALLET_ADDRESS, 'latest'),
    };

    const msg = {
      types: {
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
      },
      domain: {
        name: 'NegativeAmountHandler',
        version: '1',
        chainId: 31337,
        verifyingContract: contractAddress,
      },
      primaryType: 'Payment',
      message: payment,
    };

    // Sign the EIP712 message
    const response = await signMessage(msg);

    const signature = joinSignature({
      r: addHexPrefix(response.sig.r.toString('hex')),
      s: addHexPrefix(response.sig.s.toString('hex')),
      v: BigNumber.from(
        addHexPrefix(response.sig.v.toString('hex')),
      ).toNumber(),
    });
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
      gasLimit: '0x' + parseUnits('1000000', 'wei').toString(),
      gasPrice: '0x' + parseUnits('10', 'gwei').toString(),
    };

    const tx = TransactionFactory.fromTxData(txRequest, { common });
    const payload = rlpEncode(tx.getMessageToSign(false));

    const signedTx = await sign(payload);

    const txToBroadcast = TransactionFactory.fromTxData(
      {
        ...txRequest,
        r: addHexPrefix(signedTx.sig.r.toString('hex')),
        s: addHexPrefix(signedTx.sig.s.toString('hex')),
        v: BigNumber.from(
          addHexPrefix(signedTx.sig.v.toString('hex')),
        ).toNumber(),
      },
      { common },
    );

    const signedTxPayload = txToBroadcast.serialize();

    // Send the transaction
    const txResponse = await provider.sendTransaction(
      `0x${signedTxPayload.toString('hex')}`,
    );
    const receipt = await txResponse.wait();

    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  });

  test.skip('increment', async () => {
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
      gasLimit: parseUnits('100000', 'wei').toString(),
      gasPrice: parseUnits('10', 'gwei').toString(),
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
    const txResponse = await provider.sendTransaction(
      `0x${signedTxPayload.toString('hex')}`,
    );
    const receipt = await txResponse.wait();

    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  });
});
