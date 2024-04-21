import { Contract, JsonRpcProvider, parseUnits } from 'ethers';

import { Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import dotenv from 'dotenv';
import { question } from 'readline-sync';
import { encode as rlpEncode } from 'rlp';
import { pair, sign } from '../..';
import Counter from '../../../forge/out/Counter.sol/Counter.json';
import { setupClient } from '../utils/setup';
dotenv.config();

describe('Counter', async () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
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
