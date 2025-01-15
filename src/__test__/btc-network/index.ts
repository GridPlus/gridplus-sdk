import BitcoinCore from 'bitcoin-core';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { exec } from 'child_process';
import { promisify } from 'util';
import { setupClient } from '../utils/setup';
import { 
  fetchBtcLegacyAddresses, 
  fetchBtcSegwitAddresses, 
  fetchBtcWrappedSegwitAddresses 
} from '../../api/addresses';

const execAsync = promisify(exec);
const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';
const NETWORK = bitcoin.networks.regtest;

interface DockerCommands {
  stop: string;
  rm: string;
  rmVolumes: string;
  up: string;
}

const DOCKER_COMMANDS: DockerCommands = {
  stop: 'docker stop local_bitcoin_regtest',
  rm: 'docker rm local_bitcoin_regtest',
  rmVolumes: 'rm -rf bitcoin_data',
  up: 'docker-compose up -d'
};

async function executeCommand(command: string): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    if (!command.includes('stop') && !command.includes('rm')) {
      throw error;
    }
  }
}

async function resetBitcoinNode(): Promise<void> {
  console.log('\nResetting Bitcoin node...');
  
  await executeCommand(DOCKER_COMMANDS.stop);
  await executeCommand(DOCKER_COMMANDS.rm);
  
  await executeCommand(DOCKER_COMMANDS.rmVolumes);
  
  await executeCommand(DOCKER_COMMANDS.up);
  
  console.log('Waiting for Bitcoin node to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('Bitcoin node reset complete\n');
}

interface WalletInfo {
  walletname: string;
  walletversion: number;
  balance: number;
  unconfirmed_balance: number;
  immature_balance: number;
}

interface AddressInfo {
  address: string;
  privateKey: string;
  type: string;
  pubkey: string;
  ismine: boolean;
  solvable: boolean;
  desc: string;
  isscript: boolean;
  ischange: boolean;
  iswitness: boolean;
}

async function importPrivateKey(client: BitcoinCore, privateKey: string, label: string): Promise<void> {
  try {
    await client.command('importprivkey', privateKey, label, false);
    console.log(`Imported private key for ${label}`);
    
    const keyInfo = await client.command('getaddressinfo', await client.command('getnewaddress', label));
    console.log(`Generated address for ${label}:`, keyInfo.address);
  } catch (err) {
    console.error('Error importing private key:', err);
    throw err;
  }
}

async function createWalletFromMnemonic(
  client: BitcoinCore,
  walletName: string,
  mnemonic: string = DEFAULT_MNEMONIC
): Promise<void> {
  try {
    const wallets = await client.listWallets();
    console.log('Existing wallets:', wallets);

    if (wallets.includes(walletName)) {
      await client.unloadWallet(walletName);
      console.log('Unloaded existing wallet:', walletName);
      
      try {
        await client.command('removewallet', walletName);
        console.log('Removed wallet files:', walletName);
      } catch (err: any) {
        console.log('Note: Wallet files may have already been removed');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    await client.command('createwallet', walletName, false, false, '', false, false, true);
    console.log('Created new wallet:', walletName);

    const seed = await bip39.mnemonicToSeed(mnemonic);
    console.log('Generated seed from mnemonic');

    const root = bitcoin.bip32.fromSeed(Buffer.from(seed), NETWORK);
    console.log('Derived master key');

    const keyPaths = [
      { path: `m/44'/1'/0'/0/0`, label: 'legacy', type: 'legacy' },
      { path: `m/49'/1'/0'/0/0`, label: 'p2sh-segwit', type: 'p2sh-segwit' },
      { path: `m/84'/1'/0'/0/0`, label: 'bech32', type: 'bech32' }
    ];

    for (const { path, label, type } of keyPaths) {
      const child = root.derivePath(path);
      const wif = child.toWIF();
      await importPrivateKey(client, wif, label);
      
      const address = await client.getNewAddress(label, type as any);
      console.log(`Created ${type} address:`, address);
    }

    const info = await client.getWalletInfo();
    console.log('Wallet info:', info);

    await client.command('rescanblockchain');
    console.log('Completed blockchain rescan');
  } catch (err: any) {
    console.error('Error creating wallet:', err.message);
    throw err;
  }
}

async function generateAddress(
  client: BitcoinCore, 
  addressType: string,
  label: string = ''
): Promise<AddressInfo> {
  try {
    const address = await client.getNewAddress(label, addressType as any);
    
    const addressInfo = await client.getAddressInfo(address);
    console.log(`\nAddress info for ${addressType}:`, addressInfo);

    const privateKey = await client.dumpPrivKey(address);
    
    return {
      address,
      privateKey,
      type: addressType,
      ...addressInfo
    };
  } catch (err) {
    console.error(`Error generating ${addressType} address:`, err);
    throw err;
  }
}

async function fundAddress(
  client: BitcoinCore, 
  address: string, 
  blocks: number = 101
): Promise<void> {
  try {
    console.log(`\nMining ${blocks} blocks to ${address}...`);
    
    const blockHashes = await client.generateToAddress(blocks, address);
    console.log('Mined blocks:', blockHashes.length);
    
    const lastBlockInfo = await client.getBlock(blockHashes[blockHashes.length - 1]);
    console.log('Last block info:', {
      height: lastBlockInfo.height,
      confirmations: lastBlockInfo.confirmations,
      time: new Date(lastBlockInfo.time * 1000).toISOString()
    });

    const receivedAmount = await client.getReceivedByAddress(address);
    console.log('Address balance:', receivedAmount, 'BTC');

    const utxos = await client.listUnspent(1, 9999999, [address]);
    console.log('Unspent outputs:', utxos.length);
  } catch (err) {
    console.error('Error funding address:', err);
    throw err;
  }
}

async function sendToAddress(
  client: BitcoinCore,
  toAddress: string,
  amount: number,
  shouldGenerateBlocks: boolean = true
): Promise<void> {
  try {
    console.log(`\nSending ${amount} BTC to ${toAddress}...`);
    
    // First, make sure we have enough funds by mining if needed
    const walletInfo = await client.getWalletInfo();
    if (walletInfo.balance < amount) {
      console.log('Mining blocks to get enough funds...');
      const miningAddress = await client.getNewAddress('mining');
      await fundAddress(client, miningAddress, 101); // Mine 101 blocks to make funds mature
    }

    // Send the transaction
    const txid = await client.sendToAddress(toAddress, amount);
    console.log('Transaction sent! TXID:', txid);

    if (shouldGenerateBlocks) {
      // Mine one block to confirm the transaction
      const miningAddress = await client.getNewAddress('mining');
      const blockHashes = await client.generateToAddress(1, miningAddress);
      console.log('Mined block to confirm transaction:', blockHashes[0]);

      // Get transaction details
      const tx = await client.getTransaction(txid);
      console.log('Transaction confirmed with', tx.confirmations, 'confirmation(s)');
      console.log('Transaction fee:', tx.fee, 'BTC');
    }
  } catch (err) {
    console.error('Error sending to address:', err);
    throw err;
  }
}

async function sendToDeviceAddresses(): Promise<void> {
  try {
    // First set up the Bitcoin regtest node
    await resetBitcoinNode();

    // Create a Bitcoin Core client
    const client = new BitcoinCore({
      host: '127.0.0.1',
      port: 18443,
      username: 'user',
      password: 'pass',
      version: '0.21.0',
      wallet: 'regtest_wallet'
    });

    // Create a wallet for funding
    await createWalletFromMnemonic(client, 'regtest_wallet', DEFAULT_MNEMONIC);

    // Set up the GridPlus device
    const gridPlusClient = await setupClient();
    console.log('GridPlus device connected');

    // Fetch addresses from the device
    console.log('\nFetching device addresses...');
    
    // Get legacy addresses
    const legacyAddresses = await fetchBtcLegacyAddresses();
    console.log('\nLegacy Addresses:', legacyAddresses);

    // Get SegWit addresses
    const segwitAddresses = await fetchBtcSegwitAddresses();
    console.log('\nSegWit Addresses:', segwitAddresses);

    // Get Wrapped SegWit addresses
    const wrappedSegwitAddresses = await fetchBtcWrappedSegwitAddresses();
    console.log('\nWrapped SegWit Addresses:', wrappedSegwitAddresses);

    // Fund each type of address
    console.log('\nFunding device addresses...');

    // Fund first legacy address
    if (legacyAddresses.length > 0) {
      console.log('\nFunding Legacy Address:', legacyAddresses[0]);
      await sendToAddress(client, legacyAddresses[0], 1);
    }

    // Fund first SegWit address
    if (segwitAddresses.length > 0) {
      console.log('\nFunding SegWit Address:', segwitAddresses[0]);
      await sendToAddress(client, segwitAddresses[0], 1);
    }

    // Fund first Wrapped SegWit address
    if (wrappedSegwitAddresses.length > 0) {
      console.log('\nFunding Wrapped SegWit Address:', wrappedSegwitAddresses[0]);
      await sendToAddress(client, wrappedSegwitAddresses[0], 1);
    }

    // Show final balances
    console.log('\nFinal Balances:');
    
    for (const addr of [...legacyAddresses, ...segwitAddresses, ...wrappedSegwitAddresses]) {
      const balance = await client.getReceivedByAddress(addr);
      if (balance > 0) {
        console.log(`Address ${addr}: ${balance} BTC`);
      }
    }

  } catch (err) {
    console.error('Error in sendToDeviceAddresses:', err);
    throw err;
  }
}

export async function main(): Promise<void> {
  try {
    await sendToDeviceAddresses();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  try {
    const client = new BitcoinCore({
      host: '127.0.0.1',
      port: 18443,
      username: 'user',
      password: 'pass',
      version: '0.21.0',
    });
    
    const wallets = await client.listWallets();
    for (const wallet of wallets) {
      await client.unloadWallet(wallet);
      console.log(`Unloaded wallet: ${wallet}`);
    }
    
    await executeCommand(DOCKER_COMMANDS.stop);
    await executeCommand(DOCKER_COMMANDS.rm);
    
    console.log('\nCleanup completed');
  } catch (err) {
    console.error('Cleanup error:', err);
  }
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await executeCommand(DOCKER_COMMANDS.stop);
  await executeCommand(DOCKER_COMMANDS.rm);
  process.exit(1);
});

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await executeCommand(DOCKER_COMMANDS.stop);
  await executeCommand(DOCKER_COMMANDS.rm);
  process.exit(1);
});
