import { Client, providers } from '../../src/index';
import NodeCrypto from '@gridplus/node-crypto';
import Tx from 'ethereumjs-tx';
const sender = require('../../src/config.js').testing.ethHolder;
const senderPriv = Buffer.from(sender.privKey, 'hex');
if (process.argv.length !== 3) {
  throw new Error('Please specify a receiving address')
}
const recipient = process.argv[2];

const client = new Client({
  clientConfig: {
    name: 'basic-test',
    crypto: NodeCrypto,
    privKey: NodeCrypto.randomBytes(32).toString('hex'),
  },
  providers: [ new providers.Ethereum() ]
});

client.buildTx('ETH', sender.address, recipient, Math.pow(10, 17), (err, builtTx) => {
  if (err) throw new Error(err);
  const txObj = new Tx({
    nonce: builtTx[0],
    gasPrice: builtTx[1],
    gasLimit: builtTx[2],
    to: builtTx[3],
    value: builtTx[4],
    data: builtTx[5],
  });
  txObj.sign(senderPriv);
  const serTx = txObj.serialize();
  const data = { tx: `0x${serTx.toString('hex')}` };
  client.broadcast('ETH', data, (err, res) => {
    if (err) throw new Error(err);
    setTimeout(() => {
      client.getTx('ETH', res.hash, (err, tx) => {
        if (err) throw new Error(err)
        else if (!tx) throw new Error('Transaction was not mined')
        else console.log('Transaction successfully broadcast and mined: ', tx.hash)
      })
    })
  })
})