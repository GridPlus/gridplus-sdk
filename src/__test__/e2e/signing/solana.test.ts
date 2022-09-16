import {
  Keypair as SolanaKeypair,
  PublicKey as SolanaPublicKey,
  SystemProgram as SolanaSystemProgram,
  Transaction as SolanaTransaction,
} from '@solana/web3.js';
import { Constants } from '../../..';
import { HARDENED_OFFSET } from '../../../constants';
import { getPrng } from '../../utils/getters';
import { deriveED25519Key, prandomBuf } from '../../utils/helpers';
import { runGeneric } from '../../utils/runners';
import { initializeClient, initializeSeed } from '../../utils/initializeClient';

//---------------------------------------
// STATE DATA
//---------------------------------------
let client;
const DEFAULT_SOLANA_SIGNER = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 501,
  HARDENED_OFFSET,
  HARDENED_OFFSET,
];
const prng = getPrng();

describe('[Solana]', () => {
  client = initializeClient();
  const getReq = (overrides: any) => ({
    data: {
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
      payload: null,
      ...overrides,
    },
  });

  it('Should validate Solana transaction encoding', async () => {
    // Build a Solana transaction with two signers, each derived from the Lattice's seed.
    // This will require two separate general signing requests, one per signer.

    // Get the full set of Solana addresses and keys
    // NOTE: Solana addresses are just base58 encoded public keys. We do not
    // currently support exporting of Solana addresses in firmware but we can
    // derive them here using the exported seed.
    const seed = await initializeSeed(client);
    const derivedAPath = DEFAULT_SOLANA_SIGNER;
    const derivedBPath = DEFAULT_SOLANA_SIGNER;
    derivedBPath[3] += 1;
    const derivedCPath = DEFAULT_SOLANA_SIGNER;
    derivedCPath[3] += 2;
    const derivedA = deriveED25519Key(derivedAPath, seed);
    const derivedB = deriveED25519Key(derivedBPath, seed);
    const derivedC = deriveED25519Key(derivedCPath, seed);
    const pubA = new SolanaPublicKey(derivedA.pub);
    const pubB = new SolanaPublicKey(derivedB.pub);
    const pubC = new SolanaPublicKey(derivedC.pub);

    // Define transaction instructions
    const transfer1 = SolanaSystemProgram.transfer({
      fromPubkey: pubA,
      toPubkey: pubC,
      lamports: 111,
    });
    const transfer2 = SolanaSystemProgram.transfer({
      fromPubkey: pubB,
      toPubkey: pubC,
      lamports: 222,
    });

    // Generate a pseudorandom blockhash, which is just a public key appearently.
    const randBuf = prandomBuf(prng, 32, true);
    const recentBlockhash =
      SolanaKeypair.fromSeed(randBuf).publicKey.toBase58();

    // Build a transaction and sign it using Solana's JS lib
    const txJs = new SolanaTransaction({ recentBlockhash }).add(
      transfer1,
      transfer2,
    );
    txJs.setSigners(pubA, pubB);
    txJs.sign(
      SolanaKeypair.fromSeed(derivedA.priv),
      SolanaKeypair.fromSeed(derivedB.priv),
    );
    const serTxJs = txJs.serialize().toString('hex');

    // Build a copy of the transaction and get the serialized payload for signing in firmware.
    const txFw = new SolanaTransaction({ recentBlockhash }).add(
      transfer1,
      transfer2,
    );
    txFw.setSigners(pubA, pubB);
    // We want to sign the Solana message, not the full transaction
    const payload = txFw.compileMessage().serialize();

    // Sign payload from Lattice and add signatures to tx object
    const req = getReq({
      signerPath: derivedAPath,
      payload: `0x${payload.toString('hex')}`,
    });
    const sigA = await runGeneric(req, client).then((resp) => {
      const sigR = resp.sig?.r.toString('hex') ?? '';
      const sigS = resp.sig?.s.toString('hex') ?? '';
      return Buffer.from(`${sigR}${sigS}`, 'hex');
    });

    req.data.signerPath = derivedBPath;

    const sigB = await runGeneric(req, client).then((resp) => {
      const sigR = resp.sig?.r.toString('hex') ?? '';
      const sigS = resp.sig?.s.toString('hex') ?? '';
      return Buffer.from(`${sigR}${sigS}`, 'hex');
    });
    txFw.addSignature(pubA, sigA);
    txFw.addSignature(pubB, sigB);

    // Validate the signatures from the Lattice match those of the Solana library
    const serTxFw = txFw.serialize().toString('hex');
    expect(serTxFw).toEqualElseLog(serTxJs, 'Signed tx mismatch');
  });
});
