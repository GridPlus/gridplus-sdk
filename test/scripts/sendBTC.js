const NodeClient = require('@gridplus/bclient').NodeClient;
const bitcoin = require('bitcoinjs-lib');
const client = new NodeClient({
  host: 'localhost',
  network: 'regtest',
  port: 48332
});
const testing = require('../../src/config.js').testing;
const regtest = {  // regtest config from bcoin: http://bcoin.io/docs/protocol_networks.js.html
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'rb',
  bip32: {
    public: 0xeab4fa05,
    private: 0xeab404c7
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x26,
  wif: 0x5a
}

const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.regtestWif, regtest);

if (process.argv.length !== 3) {
  throw new Error('Please specify a receiving address')
}
const recipient = process.argv[2];
const sender = testing.btcHolder.regtestAddress;
client.getCoinsByAddress(sender)
.then((utxos) => {
  const utxo = utxos[0];
  const txb = new bitcoin.TransactionBuilder(regtest);
  txb.addInput(utxo.hash, utxo.index);
  txb.addOutput(recipient, 1e7);
  txb.addOutput(sender, utxo.value - 1e7 - 1e3);
  txb.sign(0, signer);
  const tx = txb.build().toHex();
  return client.broadcast(tx)
})
.then(() => {
  return client.execute('generate', [ 1 ])
})
.then(() => {
  console.log('Successfully broadcast transaction.')
})
.catch((err) => {
  throw new Error(err);
})