import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { question } from 'readline-sync';
import { fetchSolanaAddresses, pair, signSolanaTx } from '../../..';
import { setupClient } from '../../utils/setup';

const fetchSigningWallet = async () => {
  const addresses = await fetchSolanaAddresses({ n: 1 });
  const solanaAddr = addresses[0];
  const pubkey = new PublicKey(solanaAddr);
  expect(PublicKey.isOnCurve(pubkey)).toBeTruthy();
  return pubkey;
};

import { validateMnemonic, mnemonicToSeedSync } from 'bip39';
import { derivePath } from 'ed25519-hd-key';

// Function to generate a Solana address from a seed phrase
export const generateSolanaAddressFromSeedPhrase = async (
  seedPhrase: string,
) => {
  // Validate the seed phrase
  if (!validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase');
  }

  // Convert the seed phrase to a seed
  const seed = mnemonicToSeedSync(seedPhrase);

  // Derive the keypair using SLIP0010
  // The derivation path is based on BIP44, `m/44'/501'/0'/0'` is a common path for Solana
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;

  // Create a keypair from the derived seed
  const keypair = Keypair.fromSeed(derivedSeed.slice(0, 32));

  // Return the public key as a string
  return keypair.publicKey.toString();
};

// Example usage
const seedPhrase =
  'illegal upon goat famous math front expect pyramid icon fish tunnel tent demise near surprise way rare aisle demand outdoor dice spoil burger edge';

describe('solana.versioned', () => {
  let SOLANA_RPC: Connection;
  let SIGNER_WALLET: PublicKey;
  let DESTINATION_WALLET_1: Keypair;
  let DESTINATION_WALLET_2: Keypair;
  let latestBlockhash: { blockhash: string; lastValidBlockHeight: number };

  test('setup', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
    SOLANA_RPC = new Connection('https://api.testnet.solana.com', 'confirmed');
    SIGNER_WALLET = await fetchSigningWallet();
    DESTINATION_WALLET_1 = Keypair.generate();
    DESTINATION_WALLET_2 = Keypair.generate();
    latestBlockhash = await SOLANA_RPC.getLatestBlockhash('confirmed');
  });

  test('get solana address from seed phrase', async () => {
    const address = await generateSolanaAddressFromSeedPhrase(seedPhrase);
    const lPubkey = await fetchSigningWallet();
    const laddress = lPubkey.toString();
    const lb58 = lPubkey.toBase58();
    console.log({ laddress, lb58 });
    expect(address).toBe(laddress);
  });
  // test('sign solana', async () => {
  //   SIGNER_WALLET = await fetchSigningWallet();
  //   const txInstructions: TransactionInstruction[] = [
  //     SystemProgram.transfer({
  //       fromPubkey: SIGNER_WALLET,
  //       toPubkey: DESTINATION_WALLET_1.publicKey,
  //       lamports: 0.01 * LAMPORTS_PER_SOL,
  //     }),
  //   ];
  //   const messageV0 = new TransactionMessage({
  //     payerKey: SIGNER_WALLET,
  //     recentBlockhash: latestBlockhash.blockhash,
  //     instructions: txInstructions,
  //   }).compileToV0Message();

  //   const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));
  //   expect(signedTx).toBeTruthy();
  // });

  // test('sign solana multiple instructions', async () => {
  //   const txInstructions = [
  //     SystemProgram.transfer({
  //       fromPubkey: SIGNER_WALLET,
  //       toPubkey: DESTINATION_WALLET_1.publicKey,
  //       lamports: 0.005 * LAMPORTS_PER_SOL,
  //     }),
  //     SystemProgram.transfer({
  //       fromPubkey: SIGNER_WALLET,
  //       toPubkey: DESTINATION_WALLET_2.publicKey,
  //       lamports: 0.005 * LAMPORTS_PER_SOL,
  //     }),
  //   ];
  //   const message = new TransactionMessage({
  //     payerKey: SIGNER_WALLET,
  //     recentBlockhash: latestBlockhash.blockhash,
  //     instructions: txInstructions,
  //   }).compileToV0Message();

  //   const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
  //   expect(signedTx).toBeTruthy();
  // });

  // test('sign solana zero lamport transfer', async () => {
  //   const txInstruction = SystemProgram.transfer({
  //     fromPubkey: SIGNER_WALLET,
  //     toPubkey: DESTINATION_WALLET_1.publicKey,
  //     lamports: 0,
  //   });
  //   const message = new TransactionMessage({
  //     payerKey: SIGNER_WALLET,
  //     recentBlockhash: latestBlockhash.blockhash,
  //     instructions: [txInstruction],
  //   }).compileToV0Message();

  //   const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
  //   expect(signedTx).toBeTruthy();
  // });

  // test('simulate versioned solana transaction', async () => {
  //   // Request airdrop to fund account
  //   await SOLANA_RPC.requestAirdrop(SIGNER_WALLET, 2 * LAMPORTS_PER_SOL);
  //   await new Promise((resolve) => setTimeout(resolve, 20000));

  //   const txInstruction = SystemProgram.transfer({
  //     fromPubkey: SIGNER_WALLET,
  //     toPubkey: DESTINATION_WALLET_1.publicKey,
  //     lamports: 0.01 * LAMPORTS_PER_SOL,
  //   });

  //   const transaction = new Transaction();
  //   transaction.add(txInstruction);
  //   transaction.recentBlockhash = latestBlockhash.blockhash;
  //   transaction.feePayer = SIGNER_WALLET;

  //   // Serialize the transaction to get the wire format
  //   const serializedTransaction = transaction.serialize({
  //     requireAllSignatures: false,
  //   });

  //   // Create a VersionedTransaction from the serialized data
  //   const versionedTransaction = VersionedTransaction.deserialize(
  //     serializedTransaction,
  //   );

  //   // Simulate the versioned transaction
  //   const simulatedResult = await SOLANA_RPC.simulateTransaction(
  //     versionedTransaction,
  //     { commitment: 'confirmed' },
  //   );
  //   // Expects real value to be in the wallet
  //   expect(simulatedResult.value.err).toBeNull();

  //   const signedTx = await signSolanaTx(
  //     Buffer.from(versionedTransaction.serialize()),
  //   );
  //   expect(signedTx).toBeTruthy();
  // });

  // test('simulate versioned solana transaction with multiple instructions', async () => {
  //   const payer = Keypair.generate();
  //   // Request airdrop to fund account
  //   await SOLANA_RPC.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
  //   await new Promise((resolve) => setTimeout(resolve, 20000));

  //   const [transactionInstruction, pubkey] =
  //     await AddressLookupTableProgram.createLookupTable({
  //       payer: payer.publicKey,
  //       authority: payer.publicKey,
  //       recentSlot: await SOLANA_RPC.getSlot(),
  //     });

  //   await AddressLookupTableProgram.extendLookupTable({
  //     payer: payer.publicKey,
  //     authority: payer.publicKey,
  //     lookupTable: pubkey,
  //     addresses: [
  //       DESTINATION_WALLET_1.publicKey,
  //       DESTINATION_WALLET_2.publicKey,
  //     ],
  //   });

  //   const messageV0 = new TransactionMessage({
  //     payerKey: SIGNER_WALLET,
  //     recentBlockhash: latestBlockhash.blockhash,
  //     instructions: [transactionInstruction],
  //   }).compileToV0Message();

  //   const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));

  //   expect(signedTx).toBeDefined();
  // });
});
