import * as bitcoin from 'bitcoinjs-lib';
import { fetchAddressesByDerivationPath } from '../../api/addresses';
import { signBtc } from '../../api/signing';
import { HARDENED_OFFSET } from '../../constants';
import { Currency, PreviousOutput } from '../../types';
import { createBtcCoreClient } from '../utils/btc-core-client';
import { BtcRpc } from '../utils/btc-rpc';
import { setupClient } from '../utils/setup';

// Configure network for regtest
const network = bitcoin.networks.regtest;

describe('Bitcoin Regtest E2E Tests', () => {
  let btcCoreClient: any;  // For test wallet and funding
  let btcRpc: BtcRpc;      // For direct RPC calls
  let latticeClient: any;

  beforeAll(async () => {
    // Initialize Bitcoin Core client for test wallet
    btcCoreClient = await createBtcCoreClient();
    await btcCoreClient.checkNodeStatus();
    await btcCoreClient.createWallet('regtest_wallet');

    // Initialize direct RPC client
    btcRpc = new BtcRpc();

    // Set up Lattice1 device
    latticeClient = await setupClient();

    // Generate initial blocks to get funds
    const miningAddress = await btcCoreClient.getNewAddress('mining');
    console.log('[BtcRegtestTest] Mining initial blocks to:', miningAddress);
    await btcRpc.generateToAddress(101, miningAddress);
    
    // Wait for blocks to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check balance
    const balance = await btcCoreClient.getBalance(miningAddress);
    console.log('[BtcRegtestTest] Initial wallet balance:', balance);
  }, 60000);

  beforeEach(async () => {
    await btcCoreClient.checkNodeStatus();
    // Clean up by generating a new block
    const cleanupAddress = await btcCoreClient.getNewAddress('cleanup');
    await btcRpc.generateToAddress(1, cleanupAddress);
    // Wait for block to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 20000);

  afterAll(async () => {
    await btcCoreClient.unloadAllWallets();
  }, 10000);

  // Helper function to test funding and verifying an address
  async function testAddressFunding(address: string) {
    console.log(`[BtcRegtestTest] Testing address funding for: ${address}`);

    // Check UTXOs before funding
    const beforeUtxos = await btcRpc.listUnspent(0, 9999999, [address]);
    console.log('[BtcRegtestTest] UTXOs before funding:', beforeUtxos);

    // Fund the address using bitcoin-core client
    const fundingAmount = 0.1;
    const fundingTxid = await btcCoreClient.fundAddress(address, fundingAmount);
    expect(fundingTxid).toBeTruthy();
    console.log('[BtcRegtestTest] Funding transaction sent:', fundingTxid);

    // Generate a block to confirm funding transaction
    const miningAddress = await btcCoreClient.getNewAddress('mining');
    await btcRpc.generateToAddress(1, miningAddress);
    
    // Wait for block to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify funding transaction was confirmed
    const fundingTx = await btcRpc.getTransaction(fundingTxid);
    console.log('[BtcRegtestTest] Funding transaction details:', {
      txid: fundingTxid,
      confirmations: fundingTx.confirmations,
      amount: fundingTx.amount,
      fee: fundingTx.fee,
      blockhash: fundingTx.blockhash
    });
    expect(fundingTx.confirmations).toBeGreaterThan(0);

    // Check UTXOs after funding
    const afterUtxos = await btcRpc.listUnspent(0, 9999999, [address]);
    console.log('[BtcRegtestTest] UTXOs after funding:', afterUtxos);
    expect(afterUtxos.length).toBeGreaterThan(beforeUtxos.length);

    // Find our funding UTXO
    const fundingUtxo = afterUtxos.find(utxo => utxo.txid === fundingTxid);
    expect(fundingUtxo).toBeTruthy();
    console.log('[BtcRegtestTest] Found funding UTXO:', fundingUtxo);

    return { fundingTxid, fundingTx, fundingUtxo };
  }

  describe.skip('Bitcoin Core Wallet Tests', () => {
    it('should fund and spend from a generated address', async () => {
      // Get a new address from Bitcoin Core
      const testAddress = await btcCoreClient.getNewAddress('test', 'bech32');
      console.log('[BtcRegtestTest] Test address:', testAddress);

      // Fund the address
      const { fundingTxid, fundingTx, fundingUtxo } = await testAddressFunding(testAddress);

      // Create a destination address to send funds back to
      const destinationAddress = await btcCoreClient.getNewAddress('destination', 'bech32');
      console.log('[BtcRegtestTest] Created destination address:', destinationAddress);

      // Create and sign transaction using Bitcoin Core wallet
      const rawTx = await btcCoreClient.client.createRawTransaction(
        [{
          txid: fundingTxid,
          vout: fundingUtxo.vout
        }],
        [{
          [destinationAddress]: 0.05  // Spend half the funded amount
        }]
      );

      // Set fee rate
      const feeOptions = {
        feeRate: "0.00001", // Fee rate in BTC/kB
        replaceable: true
      };
      const fundedTx = await btcCoreClient.client.fundRawTransaction(rawTx, feeOptions);

      const signedTx = await btcCoreClient.client.signRawTransactionWithWallet(fundedTx.hex);
      expect(signedTx.complete).toBeTruthy();
      console.log('[BtcRegtestTest] Created signed transaction');

      // Broadcast and confirm
      const spendTxid = await btcRpc.sendRawTransaction(signedTx.hex);
      expect(spendTxid).toBeTruthy();
      console.log('[BtcRegtestTest] Broadcasted transaction:', spendTxid);

      // Generate a block to confirm
      const miningAddress = await btcCoreClient.getNewAddress('mining');
      await btcRpc.generateToAddress(1, miningAddress);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify confirmation
      const spendTx = await btcRpc.getRawTransaction(spendTxid, true);
      expect(spendTx.confirmations).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Lattice Tests', () => {
    let deviceAddress: string;
    let fundingUtxo: any;
    let fundingTxid: string;

    beforeAll(async () => {
      // Set up Lattice client and get address before running tests
      const startPath = [
        44 + HARDENED_OFFSET,  // BIP44 for regtest
        1 + HARDENED_OFFSET,   // Coin type 1 (same as testnet)
        HARDENED_OFFSET,       // Account 0
        0,                     // External chain
        0,                     // First address
      ];
      console.log('[BtcRegtestTest] Using derivation path:', startPath);

      // Initialize Lattice client
      latticeClient = await setupClient();
      expect(latticeClient).toBeTruthy();

      // Get address from Lattice
      const addresses = await fetchAddressesByDerivationPath(
        startPath.join('/'),
      );
      expect(addresses.length).toBeGreaterThan(0);
      deviceAddress = addresses[0];
      console.log('[BtcRegtestTest] Got device address:', deviceAddress);
    }, 60000);

    it('should fund the device address', async () => {
      expect(deviceAddress).toBeTruthy();
      console.log('[BtcRegtestTest] Testing segwit address:', deviceAddress);

      // Fund the address
      const result = await testAddressFunding(deviceAddress);
      fundingTxid = result.fundingTxid;
      fundingUtxo = result.fundingUtxo;

      // Verify funding was successful
      expect(fundingTxid).toBeTruthy();
      expect(fundingUtxo).toBeTruthy();
      expect(fundingUtxo.value).toBeGreaterThan(0);
      console.log('[BtcRegtestTest] Funding successful:', {
        txid: fundingTxid,
        value: fundingUtxo.value,
        vout: fundingUtxo.vout,
      });
    }, 60000);

    it('should sign and send transaction from funded address', async () => {
      // // Verify we have the funding info from previous test
      // expect(deviceAddress).toBeTruthy();
      // expect(fundingTxid).toBeTruthy();
      // expect(fundingUtxo).toBeTruthy();

      // Create a destination address to send funds back to
      const destinationAddress = await btcCoreClient.getNewAddress(
        'destination',
        'bech32',
      );
      console.log(
        '[BtcRegtestTest] Created destination address:',
        destinationAddress,
      );

      // Get all UTXOs for our address
      const utxos = await btcRpc.listUnspent(0, 9999999, [deviceAddress]);
      console.log('[BtcRegtestTest] Found UTXOs:', utxos);

      // Calculate total available input value
      const totalInputValue = utxos.reduce((sum, utxo) => sum + Math.round(utxo.amount * 100000000), 0);
      console.log('[BtcRegtestTest] Total input value (satoshis):', totalInputValue);

      // Build prevOuts from all available UTXOs
      const txData = {
        prevOuts: utxos.map(utxo => ({
          txHash: utxo.txid,  // Keep as hex string
          value: Math.round(utxo.amount * 100000000), // Convert BTC to satoshis
          index: utxo.vout,
          signerPath: [
            44 + HARDENED_OFFSET,  // BIP44 for regtest
            1 + HARDENED_OFFSET,   // Coin type 1 (same as testnet)
            HARDENED_OFFSET,       // Account 0
            0,                     // External chain
            0,                     // First address
          ],
        })) as PreviousOutput[],
        recipient: destinationAddress,
        value: totalInputValue - 100000, // Send all funds minus fee
        fee: 100000, // 100k satoshis fee
        changePath: [
          44 + HARDENED_OFFSET,  // BIP44 for regtest
          1 + HARDENED_OFFSET,   // Coin type 1 (same as testnet)
          HARDENED_OFFSET,       // Account 0
          1,                     // Internal chain (change)
          0,                     // First change address
        ],
      };

      console.log('[BtcRegtestTest] Transaction data:', {
        numInputs: txData.prevOuts.length,
        totalInput: totalInputValue,
        sendAmount: txData.value,
        fee: txData.fee,
        prevOuts: txData.prevOuts,
      });

      const req = {
        currency: 'BTC' as Currency,
        data: {
          ...txData,
          fwConstants: latticeClient.getFwConstants(),
        },
      };

      // Sign transaction
      const sigResp = await signBtc(req);
      console.log('[BtcRegtestTest] Signed transaction:', sigResp);
      expect(sigResp.tx).toBeTruthy();
      expect(sigResp.txHash).toBeTruthy();
      expect(sigResp.sigs.length).toBe(txData.prevOuts.length);

      // Broadcast the signed transaction
      const txid = await btcRpc.sendRawTransaction(sigResp.tx);
      console.log('[BtcRegtestTest] Broadcasted transaction:', txid);
      expect(txid).toBeTruthy();

      // Generate a block to confirm the transaction
      const miningAddress = await btcCoreClient.getNewAddress('mining');
      await btcRpc.generateToAddress(1, miningAddress);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify the transaction was confirmed
      const tx = await btcRpc.getRawTransaction(txid, true);
      expect(tx.confirmations).toBeGreaterThan(0);
    });
  });
});
