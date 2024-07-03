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
import {
  Constants,
  fetchSolanaAddresses,
  pair,
  sign,
  signSolanaTx,
} from '../../../..';
import { setupClient } from '../../../utils/setup';

const SOLANA_RPC = new Connection('https://api.devnet.solana.com', 'confirmed');

const fetchSigningWallet = async () => {
  const addresses = await fetchSolanaAddresses({ n: 1 });
  const solanaAddr = addresses[0];
  const pubkey = new PublicKey(solanaAddr);
  expect(PublicKey.isOnCurve(pubkey)).toBeTruthy();
  return pubkey;
};

const requestAirdrop = async (wallet: PublicKey, lamports: number) => {
  try {
    await SOLANA_RPC.requestAirdrop(wallet, lamports * LAMPORTS_PER_SOL);
    await new Promise((resolve) => setTimeout(resolve, 20000));
  } catch (error) {
    /**
     *  The faucet is flakey, so you might need to request funds manually from the faucet at https://faucet.solana.com/
     *  Also, for Solana to work, your address must have interacted with the network previously.
     */
    console.log(error);
  }
};

describe('solana.versioned', () => {
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
    SIGNER_WALLET = await fetchSigningWallet();
    DESTINATION_WALLET_1 = Keypair.generate();
    DESTINATION_WALLET_2 = Keypair.generate();
    latestBlockhash = await SOLANA_RPC.getLatestBlockhash('confirmed');
  });

  test('sign solana', async () => {
    SIGNER_WALLET = await fetchSigningWallet();
    const txInstructions: TransactionInstruction[] = [
      SystemProgram.transfer({
        fromPubkey: SIGNER_WALLET,
        toPubkey: DESTINATION_WALLET_1.publicKey,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      }),
    ];
    const messageV0 = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('sign solana multiple instructions', async () => {
    const txInstructions = [
      SystemProgram.transfer({
        fromPubkey: SIGNER_WALLET,
        toPubkey: DESTINATION_WALLET_1.publicKey,
        lamports: 0.005 * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: SIGNER_WALLET,
        toPubkey: DESTINATION_WALLET_2.publicKey,
        lamports: 0.005 * LAMPORTS_PER_SOL,
      }),
    ];
    const message = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('sign solana zero lamport transfer', async () => {
    const txInstruction = SystemProgram.transfer({
      fromPubkey: SIGNER_WALLET,
      toPubkey: DESTINATION_WALLET_1.publicKey,
      lamports: 0,
    });
    const message = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [txInstruction],
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('simulate versioned solana transaction', async () => {
    await requestAirdrop(SIGNER_WALLET, 1);

    const txInstruction = SystemProgram.transfer({
      fromPubkey: SIGNER_WALLET,
      toPubkey: DESTINATION_WALLET_1.publicKey,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    });

    const transaction = new Transaction();
    transaction.add(txInstruction);
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = SIGNER_WALLET;

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

  test('simulate versioned solana transaction with multiple instructions', async () => {
    const payer = Keypair.generate();
    await requestAirdrop(payer.publicKey, 1);

    const [transactionInstruction, pubkey] =
      await AddressLookupTableProgram.createLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        recentSlot: await SOLANA_RPC.getSlot(),
      });

    await AddressLookupTableProgram.extendLookupTable({
      payer: payer.publicKey,
      authority: payer.publicKey,
      lookupTable: pubkey,
      addresses: [
        DESTINATION_WALLET_1.publicKey,
        DESTINATION_WALLET_2.publicKey,
      ],
    });

    const messageV0 = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [transactionInstruction],
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));

    expect(signedTx).toBeDefined();
  });

  test('simulate versioned solana transactions from nufi', async () => {
    // sign transaction
    sign(null, {
      data: {
        signerPath: [2147483692, 2147484149, 2147483649, 2147483648],
        curveType: Constants.SIGNING.CURVES.ED25519,
        encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
        hashType: Constants.SIGNING.HASHES.NONE,
        payload: Buffer.from(
          '800100131b7154e1c10d16949038dd040363bca1f9d6501c694f6e0325ad817166fb2e91ee0c503f9578fb1f7621e5a0c2c384547f22cd4116be06e523219f332b61d41644801401dbe3c1c1f14a4eca5605ce5071e3301e79a79d95ecc50c73b977286be44ffdb307c4cce0aa81999d925e13f482e6deb72c8cc1d31ebf6b95478bd11f4f0cd8b42c34cd1d82beaec835fd525d1e90c248cf6849b277e78015a46e48789107a241e063d943cba135e306d4f8059f2ecf7a69744b993531a9d767674c85c7f6d2eabe47377602308731d0ac6ee6483c3a0f34b6aff13d37e53e00719032e928a52bdc5c44449874879e44c88ed5eb62b77a2b5e672ab9f50010479abc43e10306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a4000000006b5efb175d780346c18fa61f588190e5981c4668d651d67ad73c36e31180fdf9aca3abb5a18a0fe31a5031e7765dc6264a19fa84b3925e256dc2b4e53974b3c06b43c95041249ed7dedfc195aec0bc3ff2760a53409c79a7607b29fa3a12ad61393a26044ecc1adf84705420dd79ceeeca7be0dc63cd55a3994d9aba59b0e4303da8d1d21a468a26ba2183fd61de731ca4d5d61fd81296f97d916d81fd074ba18a633ac3c601aff49b0ffb943b9cdc1d89793f880bd8765868fd1ab42aa3b670286c0be1afb0442e17ee761789fe71c6e6914dd5771f7993092c9ca8bb05f3ae77546322de214d7944e9846236fe15e4f47731268ee9d6f60dcd058c96ea60a930890e9e6be0f4b35f0bf2f4c373f074ecc0404d221729981f11bb0dd5586fa55ac0b630d53e1fbf40c31f6163a1fed819daad6c34ec6eebbd2c9094ab8f0868ad7baf66ee465a9f41bc1fb7e3f72b663d4bfd34fe585e91fbd1f2753437cbad2569d176621a5d281ef6683261d8cc0da378f1139f1c01996edda54eb109ac4348ea0872c378762af7b1423c9c5b5ad1dd48584fcdbdb10e4922e01573228b8cd362cd18826752b72a9bf8c3d1fd7e3faeec4d44bd0f8988a902511c22b6ab46ba8557b567c6cbcd3e23efe17a9df8269dddf11d65a8f703314b84688b0bb9954004e7014187f35fb8aa37fc7e7cfe9c21e1e3def76baa18ab0668b61cf8bb66c55c082dfa8853bec08eeb7402096300a48b0b7259205ca703a1eaa032a21f6dcf2b4502abaead6d2b5495f0ea97222e2cd76aefb60c8d59d435e7a51cab236333b989b9593098437cfe28786fd22445b730c237a17d1110c8fef327d5f058e0308000502882502000800090333000000000000000922010a021b1c1d1e09030000040909040b0506070c0d0e0f101112131415161718191a7166063d1201daebea164609000000000016460900b9b0b7828d68598fa5ddf8fd4e8ba1315b7afae1785fb6ce5632d8699dd56fb15e4372ff949cf950d5dd678d5622184bc37b32d3a396f9d41ab609e65b1496b3040000000017262704000000010000008a02585c0a0000000000016400017b6eea3282722d20e3d0b0ce1eef6cf588aa519c82103084255fc33deb476d72000416170015',
          'hex',
        ),
      },
    });
    // signMessage
    sign(null, {
      data: {
        signerPath: [2147483692, 2147484149, 2147483649, 2147483648],
        curveType: Constants.SIGNING.CURVES.ED25519,
        encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
        hashType: Constants.SIGNING.HASHES.NONE,
        payload: Buffer.from(
          '6d616769636564656e2e696f2077616e747320796f7520746f207369676e20696e207769746820796f757220536f6c616e61206163636f756e743a0a386451393746414e6368337a75346348426942793556365a716478555365547858465873624b62436e6451710a0a57656c636f6d6520746f204d61676963204564656e2e205369676e696e6720697320746865206f6e6c79207761792077652063616e207472756c79206b6e6f77207468617420796f752061726520746865206f776e6572206f66207468652077616c6c657420796f752061726520636f6e6e656374696e672e205369676e696e67206973206120736166652c206761732d6c657373207472616e73616374696f6e207468617420646f6573206e6f7420696e20616e79207761792067697665204d61676963204564656e207065726d697373696f6e20746f20706572666f726d20616e79207472616e73616374696f6e73207769746820796f75722077616c6c65742e0a0a5552493a2068747470733a2f2f6d616769636564656e2e696f2f706f70756c61722d636f6c6c656374696f6e730a56657273696f6e3a20310a436861696e2049443a206d61696e6e65740a4e6f6e63653a2038373066313166646234373734353962393433353730316463366532353035350a4973737565642041743a20323032342d30372d30325431353a32383a34382e3736305a0a526571756573742049443a2063313331346235622d656365382d346234662d613837392d333839346464613336346534',
          'hex',
        ),
      },
    });
  });
});
