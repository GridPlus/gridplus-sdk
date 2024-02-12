import {
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

describe('solana.versioned', () => {
  let SOLANA_RPC: Connection;
  let SIGNING_WALLET: PublicKey;
  let DESTINATION_WALLET_1: Keypair;
  let DESTINATION_WALLET_2: Keypair;
  let latestBlockhash: { blockhash: string; lastValidBlockHeight: number };

  test('setup', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
    SOLANA_RPC = new Connection('https://api.devnet.solana.com', 'confirmed');
    SIGNING_WALLET = await fetchSigningWallet();
    DESTINATION_WALLET_1 = Keypair.generate();
    DESTINATION_WALLET_2 = Keypair.generate();
    latestBlockhash = await SOLANA_RPC.getLatestBlockhash('confirmed');
  });

  test('sign solana', async () => {
    SIGNING_WALLET = await fetchSigningWallet();
    const txInstructions: TransactionInstruction[] = [
      SystemProgram.transfer({
        fromPubkey: SIGNING_WALLET,
        toPubkey: DESTINATION_WALLET_1.publicKey,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      }),
    ];
    const messageV0 = new TransactionMessage({
      payerKey: SIGNING_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('sign solana multiple instructions', async () => {
    const txInstructions = [
      SystemProgram.transfer({
        fromPubkey: SIGNING_WALLET,
        toPubkey: DESTINATION_WALLET_1.publicKey,
        lamports: 0.005 * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: SIGNING_WALLET,
        toPubkey: DESTINATION_WALLET_2.publicKey,
        lamports: 0.005 * LAMPORTS_PER_SOL,
      }),
    ];
    const message = new TransactionMessage({
      payerKey: SIGNING_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('sign solana zero lamport transfer', async () => {
    const txInstruction = SystemProgram.transfer({
      fromPubkey: SIGNING_WALLET,
      toPubkey: DESTINATION_WALLET_1.publicKey,
      lamports: 0,
    });
    const message = new TransactionMessage({
      payerKey: SIGNING_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [txInstruction],
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
    expect(signedTx).toBeTruthy();
  });

  /**
   * TODO:
   *
   * This test expects the address to exist on the network, which apparently it does not exist until
   * it is in a transaction. We need to figure out how to handle that in the test suite. It would be
   * really nice to be able to simulate txs and test our signed payload against them.
   *
   */
  test.todo('simulate versioned solana transaction', async () => {
    const txInstruction = SystemProgram.transfer({
      fromPubkey: SIGNING_WALLET,
      toPubkey: DESTINATION_WALLET_1.publicKey,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    });

    const transaction = new Transaction();
    transaction.add(txInstruction);
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = SIGNING_WALLET;

    // Serialize the transaction to get the wire format
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });

    // Create a VersionedTransaction from the serialized data
    const versionedTransaction = VersionedTransaction.deserialize(
      serializedTransaction,
    );

    // Simulate the versioned transaction
    const simulatedResult = await SOLANA_RPC.simulateTransaction(
      versionedTransaction,
      { commitment: 'confirmed' },
    );
    // Expects real value to be in the wallet
    expect(simulatedResult.value.err).toBeNull();

    const signedTx = await signSolanaTx(
      Buffer.from(versionedTransaction.serialize()),
    );
    expect(signedTx).toBeTruthy();
  });
});
