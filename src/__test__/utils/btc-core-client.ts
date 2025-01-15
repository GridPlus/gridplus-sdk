const BitcoinCore = require('bitcoin-core');
import { address as btcAddress, networks, payments } from 'bitcoinjs-lib';

interface UTXO {
  txid: string;
  vout: number;
  value: number;  // Amount in satoshis
  height: number;
  confirmations: number;
  address?: string;
  label?: string;
  scriptPubKey?: string;
  amount?: number;  // Amount in BTC
  spendable?: boolean;
  solvable?: boolean;
  desc?: string;
  safe?: boolean;
}

interface IBtcCoreClient {
  client: typeof BitcoinCore;
  walletName: string;
  ensureWalletLoaded(): Promise<void>;
  createWallet(walletName: string): Promise<void>;
  loadWallet(walletName: string): Promise<void>;
  unloadAllWallets(): Promise<void>;
  getUtxos(address: string): Promise<UTXO[]>;
  checkNodeStatus(): Promise<void>;
  generateBlocks(count: number, address?: string): Promise<string[]>;
  getNewAddress(label?: string, addressType?: 'legacy' | 'p2sh-segwit' | 'bech32'): Promise<string>;
  getRawTransaction(txid: string, verbose?: boolean): Promise<any>;
  fundAddress(address: string, amount: number): Promise<string>;
  broadcastTransaction(signedTxHex: string): Promise<string>;
  getTransaction(txid: string): Promise<any>;
  decodeRawTransaction(txHex: string): Promise<any>;
  getBalance(address: string): Promise<number>;
}

export class BtcCoreClient implements IBtcCoreClient {
  public client: typeof BitcoinCore;
  public walletName: string;

  constructor(walletName: string = 'regtest_wallet') {
    this.walletName = walletName;
    this.client = new BitcoinCore({
      host: '127.0.0.1',
      port: 18443,
      username: 'user',
      password: 'pass',
      version: '0.21.0',
      network: 'regtest'
    });
  }

  // Public wallet management methods
  async createWallet(walletName: string): Promise<void> {
    try {
      console.log(`[BtcCoreClient] Creating wallet: ${walletName}`);
      await this.client.createWallet(walletName);
      this.walletName = walletName;
      this.client.wallet = walletName;
      console.log(`[BtcCoreClient] Wallet created: ${walletName}`);
    } catch (error: any) {
      if (error.code === -4) {
        console.log(`[BtcCoreClient] Wallet already exists: ${walletName}`);
        this.walletName = walletName;
        this.client.wallet = walletName;
      } else {
        console.error(`[BtcCoreClient] Error creating wallet:`, error);
        throw error;
      }
    }
  }

  async loadWallet(walletName: string): Promise<void> {
    try {
      console.log(`[BtcCoreClient] Loading wallet: ${walletName}`);
      await this.client.loadWallet(walletName);
      this.walletName = walletName;
      this.client.wallet = walletName;
      console.log(`[BtcCoreClient] Wallet loaded: ${walletName}`);
    } catch (error) {
      console.error(`[BtcCoreClient] Error loading wallet:`, error);
      throw error;
    }
  }

  public async ensureWalletLoaded(): Promise<void> {
    try {
      // List available wallets
      const wallets = await this.client.listWallets();
      console.log(`[BtcCoreClient] Available wallets:`, wallets);

      // Check if our wallet is already loaded
      if (wallets.includes(this.walletName)) {
        console.log(`[BtcCoreClient] Wallet ${this.walletName} is already loaded`);
        this.client.wallet = this.walletName;
        return;
      }

      // Try to load the wallet
      try {
        await this.loadWallet(this.walletName);
      } catch (loadError: any) {
        // If wallet doesn't exist, create it
        if (loadError.code === -18) {
          await this.createWallet(this.walletName);
        } else {
          throw loadError;
        }
      }
    } catch (error) {
      console.error(`[BtcCoreClient] Error ensuring wallet is loaded:`, error);
      throw error;
    }
  }

  async unloadAllWallets(): Promise<void> {
    try {
      const wallets = await this.client.listWallets();
      for (const wallet of wallets) {
        await this.client.unloadWallet(wallet);
      }
    } catch (error) {
      console.error(`[BtcCoreClient] Error unloading wallets:`, error);
      throw error;
    }
  }

  async getUtxos(address: string): Promise<UTXO[]> {
    try {
      await this.ensureWalletLoaded();
      console.log(`[BtcCoreClient] Getting UTXOs for address: ${address}`);
      
      // Import address with rescan
      await this.client.command('importaddress', address, '', true);
      
      // Get UTXOs for this address
      const utxos = await this.client.listUnspent(0, 9999999, [address]);
      console.log(`[BtcCoreClient] Found ${utxos.length} UTXOs for address ${address}`);
      
      return utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: Math.floor(utxo.amount * 100000000),  // Convert BTC to satoshis
        height: utxo.height,
        confirmations: utxo.confirmations
      }));
    } catch (error) {
      console.error(`[BtcCoreClient] Error getting UTXOs:`, error);
      throw error;
    }
  }

  async checkNodeStatus(): Promise<void> {
    try {
      const networkInfo = await this.client.getNetworkInfo();
      console.log(`[BtcCoreClient] Network info:`, networkInfo);

      const blockchainInfo = await this.client.getBlockchainInfo();
      console.log(`[BtcCoreClient] Blockchain info:`, blockchainInfo);

      const miningInfo = await this.client.getMiningInfo();
      console.log(`[BtcCoreClient] Mining info:`, miningInfo);

      console.log(`[BtcCoreClient] Node status check complete`);
    } catch (error) {
      console.error(`[BtcCoreClient] Error checking node status:`, error);
      throw error;
    }
  }

  async generateBlocks(count: number, address?: string): Promise<string[]> {
    try {
      await this.ensureWalletLoaded();
      
      // Get current block height
      const { blocks: currentHeight } = await this.client.getBlockchainInfo();
      
      const miningAddress = address || await this.client.getNewAddress('mining');
      console.log(`[BtcCoreClient] Generating ${count} blocks`);
      
      // Generate blocks with single retry
      let blockHashes: string[] = [];
      try {
        blockHashes = await this.client.generateToAddress(count, miningAddress);
      } catch (error: any) {
        console.error(`[BtcCoreClient] Block generation failed, retrying:`, error.message);
        // Wait longer before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        blockHashes = await this.client.generateToAddress(count, miningAddress);
      }

      // Verify the blocks were generated
      const { blocks: newHeight } = await this.client.getBlockchainInfo();
      const heightDiff = newHeight - currentHeight;
      console.log(`[BtcCoreClient] Generated ${heightDiff} blocks`);

      return blockHashes;
    } catch (error) {
      console.error(`[BtcCoreClient] Block generation failed:`, error);
      throw error;
    }
  }

  async getNewAddress(label?: string, addressType?: 'legacy' | 'p2sh-segwit' | 'bech32'): Promise<string> {
    await this.ensureWalletLoaded();
    console.log(`[BtcCoreClient] Generating new address. Label: ${label || '(none)'}, Type: ${addressType || '(default)'}`);
    const address = addressType
      ? await this.client.command('getnewaddress', label || '', addressType)
      : await this.client.command('getnewaddress', label || '');
    console.log(`[BtcCoreClient] Generated new address: ${address}`);
    return address;
  }

  async getRawTransaction(txid: string, verbose?: boolean): Promise<any> {
    try {
      await this.ensureWalletLoaded();
      console.log(`[BtcCoreClient] Getting raw transaction: ${txid}, verbose: ${verbose}`);
      
      try {
        if (verbose) {
          // For verbose mode, use getrawtransaction with full details
          const tx = await this.client.command('getrawtransaction', txid, true);
          console.log(`[BtcCoreClient] Got verbose transaction:`, {
            txid: tx.txid,
            hasVout: !!tx.vout,
            voutLength: tx.vout?.length,
          });
          return tx;
        } else {
          // For non-verbose mode, just get the hex
          const txHex = await this.client.command('getrawtransaction', txid);
          console.log(`[BtcCoreClient] Got raw transaction hex`);
          return txHex;
        }
      } catch (error: any) {
        // If transaction not found in mempool/blockchain, try wallet
        if (error.message.includes('No such mempool transaction')) {
          console.log(`[BtcCoreClient] Transaction not in mempool, trying wallet transaction`);
          const walletTx = await this.client.getTransaction(txid);
          
          if (verbose) {
            // For verbose mode, decode the raw transaction
            if (!walletTx.hex) {
              throw new Error('Wallet transaction missing hex');
            }
            const decodedTx = await this.client.command('decoderawtransaction', walletTx.hex);
            console.log(`[BtcCoreClient] Decoded wallet transaction:`, {
              txid: decodedTx.txid,
              hasVout: !!decodedTx.vout,
              voutLength: decodedTx.vout?.length,
            });
            return decodedTx;
          }
          
          if (!walletTx.hex) {
            throw new Error('Wallet transaction missing hex');
          }
          return walletTx.hex;
        }
        throw error;
      }
    } catch (error) {
      console.error(`[BtcCoreClient] Error getting raw transaction:`, error);
      throw error;
    }
  }

  async fundAddress(address: string, amount: number): Promise<string> {
    try {
      await this.ensureWalletLoaded();
      console.log(`[BtcCoreClient] Funding address ${address} with ${amount} BTC`);
      
      // Get current balance
      const balance = await this.client.getBalance();
      console.log(`[BtcCoreClient] Current wallet balance: ${balance} BTC`);
      
      // Send the transaction with explicit confirmation target and estimate mode
      const txid = await this.client.sendToAddress(
        address, 
        amount,
        '', // comment
        '', // comment_to
        false, // subtractfeefromamount
        false, // replaceable
        1, // conf_target
        'CONSERVATIVE' // estimate_mode
      );
      console.log(`[BtcCoreClient] Sent funding transaction: ${txid}`);
      
      // Get the transaction details
      const tx = await this.client.getTransaction(txid);
      console.log(`[BtcCoreClient] Funding transaction details:`, {
        txid: tx.txid,
        amount: tx.amount,
        fee: tx.fee,
        hex: tx.hex ? 'present' : 'missing',
        confirmations: tx.confirmations
      });
      
      // Generate a block to confirm the transaction
      const miningAddress = await this.client.getNewAddress('mining');
      await this.generateBlocks(1, miningAddress);
      console.log(`[BtcCoreClient] Generated block to confirm funding transaction`);
      
      // Get updated transaction details
      const confirmedTx = await this.client.getTransaction(txid);
      console.log(`[BtcCoreClient] Confirmed transaction details:`, {
        txid: confirmedTx.txid,
        amount: confirmedTx.amount,
        fee: confirmedTx.fee,
        hex: confirmedTx.hex ? 'present' : 'missing',
        confirmations: confirmedTx.confirmations,
        blockhash: confirmedTx.blockhash
      });
      
      return txid;
    } catch (error) {
      console.error(`[BtcCoreClient] Error funding address:`, error);
      throw error;
    }
  }

  async broadcastTransaction(signedTxHex: string): Promise<string> {
    try {
      await this.ensureWalletLoaded();
      console.log(`[BtcCoreClient] Broadcasting transaction:`, signedTxHex);
      
      // Decode the transaction first to check its contents
      const decodedTx = await this.client.decodeRawTransaction(signedTxHex);
      console.log(`[BtcCoreClient] Decoded transaction:`, {
        txid: decodedTx.txid,
        version: decodedTx.version,
        size: decodedTx.size,
        vsize: decodedTx.vsize,
        locktime: decodedTx.locktime,
        vin: decodedTx.vin.map(input => ({
          txid: input.txid,
          vout: input.vout,
          scriptSig: input.scriptSig,
          sequence: input.sequence
        })),
        vout: decodedTx.vout.map(output => ({
          value: output.value,
          valueInSatoshis: Math.floor(output.value * 100000000),
          n: output.n,
          scriptPubKey: output.scriptPubKey
        }))
      });
      
      const txid = await this.client.sendRawTransaction(signedTxHex);
      console.log(`[BtcCoreClient] Broadcasted transaction: ${txid}`);
      return txid;
    } catch (error) {
      console.error(`[BtcCoreClient] Error broadcasting transaction:`, error);
      throw error;
    }
  }

  async getTransaction(txid: string): Promise<any> {
    try {
      await this.ensureWalletLoaded();
      const tx = await this.client.getTransaction(txid);
      console.log(`[BtcCoreClient] Got transaction: ${txid}`);
      return tx;
    } catch (error) {
      console.error(`[BtcCoreClient] Error getting transaction:`, error);
      throw error;
    }
  }

  // Add a helper method to decode raw transactions
  async decodeRawTransaction(txHex: string): Promise<any> {
    try {
      await this.ensureWalletLoaded();
      const decodedTx = await this.client.command('decoderawtransaction', txHex);
      return decodedTx;
    } catch (error) {
      console.error(`[BtcCoreClient] Error decoding transaction:`, error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<number> {
    try {
      await this.ensureWalletLoaded();
      console.log(`[BtcCoreClient] Getting balance for address: ${address}`);
      
      // Import the address as watchonly if it's not in our wallet
      try {
        await this.client.command('importaddress', address, '', false);
      } catch (error) {
        console.log(`[BtcCoreClient] Address ${address} already imported`);
      }
      
      // Get received amount for this address
      const received = await this.client.command('listreceivedbyaddress', 0, true, true);
      console.log(`[BtcCoreClient] Received transactions:`, received);
      
      const addressInfo = received.find((r: any) => r.address === address);
      const balance = addressInfo ? addressInfo.amount : 0;
      console.log(`[BtcCoreClient] Balance for ${address}: ${balance} BTC`);
      
      return balance;
    } catch (error) {
      console.error(`[BtcCoreClient] Error getting balance for address ${address}:`, error);
      throw error;
    }
  }
}

// Export the factory function that returns the interface type
export function createBtcCoreClient(): IBtcCoreClient {
  const client = new BtcCoreClient();
  // Bind all methods to preserve 'this' context
  return {
    client: client.client,
    walletName: client.walletName,
    ensureWalletLoaded: () => client.ensureWalletLoaded(),
    createWallet: (walletName: string) => client.createWallet(walletName),
    loadWallet: (walletName: string) => client.loadWallet(walletName),
    unloadAllWallets: () => client.unloadAllWallets(),
    getUtxos: (address: string) => client.getUtxos(address),
    checkNodeStatus: () => client.checkNodeStatus(),
    generateBlocks: (count: number, address?: string) => client.generateBlocks(count, address),
    getNewAddress: (label?: string, addressType?: 'legacy' | 'p2sh-segwit' | 'bech32') => 
      client.getNewAddress(label, addressType),
    getRawTransaction: (txid: string, verbose?: boolean) => client.getRawTransaction(txid, verbose),
    fundAddress: (address: string, amount: number) => client.fundAddress(address, amount),
    broadcastTransaction: (signedTxHex: string) => client.broadcastTransaction(signedTxHex),
    getTransaction: (txid: string) => client.getTransaction(txid),
    decodeRawTransaction: (txHex: string) => client.decodeRawTransaction(txHex),
    getBalance: (address: string) => client.getBalance(address)
  };
} 