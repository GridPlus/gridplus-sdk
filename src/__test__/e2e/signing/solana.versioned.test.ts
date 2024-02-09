import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
} from '@solana/web3.js';
import { question } from 'readline-sync';
import { fetchSolanaAddresses, pair, signSolanaTx } from '../../..';
import { setupClient } from '../../utils/setup';

describe('solana.versioned', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test('sign solana', async () => {
    const SOLANA_RPC = new Connection(
      'https://api.devnet.solana.com',
      'confirmed',
    );

    const address = await fetchSolanaAddresses({
      n: 1,
    });
    console.log(address);
    const SIGNING_WALLET = new PublicKey(address[0]);
    const DESTINATION_WALLET = Keypair.generate();

    const txInstructions: TransactionInstruction[] = [
      SystemProgram.transfer({
        fromPubkey: SIGNING_WALLET,
        toPubkey: DESTINATION_WALLET.publicKey,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      }),
    ];
    const latestBlockhash = await SOLANA_RPC.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: SIGNING_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));
    expect(signedTx).toBeTruthy();
  });
});
