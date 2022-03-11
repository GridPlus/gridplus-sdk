/**
Test generic signing, which allows a signature on the secp256k1 or ed25519 curve.
We seek to validate:
1. Signature on data can be reproduced locally with the derived key
2. Signature on data representing ETH tx matches the ETH route itself
3. Many random signatures can be validated

You must have `FEATURE_TEST_RUNNER=0` enabled in firmware to run these tests.
 */
import { 
  Keypair as SolanaKeypair, 
  PublicKey as SolanaPublicKey, 
  SystemProgram as SolanaSystemProgram, 
  Transaction as SolanaTransaction 
} from '@solana/web3.js'
import { 
  BaseAccount as TerraBaseAccount,
  Coin as TerraCoin,
  Coins as TerraCoins,
  Fee as TerraFee, 
  LCDClient as TerraClient,
  ModeInfo as TerraModeInfo,
  MsgSend as TerraMsgSend,
  MsgSubmitProposal as TerraMsgSubmitProposal,
  MsgExecuteContract as TerraMsgExecuteContract,
  MsgMultiSend as TerraMsgMultiSend,
  ParameterChangeProposal as TerraParameterChangeProposal,
  RawKey as TerraRawKey, 
  SignDoc as TerraSignDoc,
  SignerInfo as TerraSignerInfo,
} from '@terra-money/terra.js'
import {
  SignMode as TerraSignMode
} from '@terra-money/terra.proto/cosmos/tx/signing/v1beta1/signing';
import { expect } from 'chai';
import seedrandom from 'seedrandom';
import helpers from './testUtil/helpers';
import { getFwVersionConst, HARDENED_OFFSET } from '../src/constants'
import { Constants } from '../src/index'
import { getEncodedPayload } from '../src/genericSigning'

const prng = new seedrandom(process.env.SEED || Math.random().toString())

let client, req, seed, fwConstants, continueTests = true;
let terra;
const DEFAULT_SIGNER = [ 
  HARDENED_OFFSET + 44, HARDENED_OFFSET + 60, HARDENED_OFFSET, 0, 0 
];
const DEFAULT_SOLANA_SIGNER = [
  HARDENED_OFFSET + 44, HARDENED_OFFSET + 501, HARDENED_OFFSET, HARDENED_OFFSET
]
const DEFAULT_TERRA_SIGNER = [
  HARDENED_OFFSET + 44, HARDENED_OFFSET + 330, HARDENED_OFFSET, 0, 0,
]

async function run(req, expectedErr=undefined) {
  continueTests = false;
  try {
    const resp = await client.sign(req);
    // If no encoding type is specified we encode in hex or ascii
    const encodingType = req.data.encodingType || null; 
    const allowedEncodings = fwConstants.genericSigning.encodingTypes;
    const { payloadBuf } = getEncodedPayload(req.data.payload, encodingType, allowedEncodings);
    helpers.validateGenericSig(seed, resp.sig, payloadBuf, req.data);
  } catch (err) {
    if (expectedErr) {
      continueTests = true;
    }
    return;
  }
  continueTests = true;
  return resp;
}

describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    continueTests = false;
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const isPaired = await client.connect(process.env.DEVICE_ID);
    expect(isPaired).to.equal(true);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    fwConstants = getFwVersionConst(client.fwVersion);
    if (!fwConstants.genericSigning) {
      continueTests = false;
      expect(true).to.equal(false, 'Firmware must be updated to run this test.')
    }
    continueTests = true;
  });
});

describe('Export seed', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
  });

  it('Should export the seed', async () => {
    const activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid);
    const jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    const jobData = {};
    const jobReq = {
      testID: 0, // wallet_job test ID
      payload: helpers.serializeJobData(jobType, activeWalletUID, jobData),
    };
    const res = await client.test(jobReq);
    const _res = helpers.parseWalletJobResp(res, client.fwVersion);
    continueTests = _res.resultStatus === 0;
    expect(_res.resultStatus).to.equal(0);
    const data = helpers.deserializeExportSeedJobResult(_res.result);
    seed = helpers.copyBuffer(data.seed);
  });
})

describe('Generic signing', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        signerPath: DEFAULT_SIGNER,
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.KECCAK256,
        payload: null,
      }
    };
  })

  it('Should test pre-hashed messages', async () => {
    const { extraDataFrameSz, extraDataMaxFrames, genericSigning } = fwConstants;
    const { baseDataSz } = genericSigning;
    // Max size that won't be prehashed
    const maxSz = baseDataSz + (extraDataMaxFrames * extraDataFrameSz);
    // Use extraData frames
    req.data.payload = `0x${helpers.prandomBuf(prng, maxSz, true).toString('hex')}`;
    await run(req);
    if (!continueTests) {
      return;
    }
    // Prehash (keccak256)
    req.data.payload = `0x${helpers.prandomBuf(prng, maxSz + 1, true).toString('hex')}`;
    await run(req);
    if (!continueTests) {
      return;
    }
    // Prehash (sha256)
    req.data.hashType = Constants.SIGNING.HASHES.SHA256;
    await run(req);
  })

  it('Should test ASCII text formatting', async () => {
    // Build a payload that uses spaces and newlines
    req.data.payload = JSON.stringify({ 
      testPayload: 'json with spaces', 
      anotherThing: -1 
    }, null, 2);
    await run(req);
  })

  it('Should validate SECP256K1/KECCAK signature against dervied key', async () => {
    // ASCII message encoding
    req.data.payload = 'test'
    await run(req);
    if (!continueTests) {
      return;
    }
    // Hex message encoding
    req.data.payload = '0x123456'
    await run(req);
  })

  it('Should validate ED25519/NULL signature against dervied key', async () => {
    // Make generic signing request
    req.data.payload = '0x123456';
    req.data.curveType = Constants.SIGNING.CURVES.ED25519;
    req.data.hashType = Constants.SIGNING.HASHES.NONE;
    // ED25519 derivation requires hardened indices
    req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
    await run(req);
  })

  it('Should validate SECP256K1/KECCAK signature against ETH_MSG request (legacy)', async () => {
    // Generic request
    const msg = 'Testing personal_sign';
    const psMsg = helpers.ethPersonalSignMsg(msg);
    // NOTE: The request contains some non ASCII characters so it will get 
    // encoded as hex automatically.
    req.data.payload = psMsg;
    // Legacy request
    const legacyReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: req.data.signerPath,
        payload: msg,
        protocol: 'signPersonal'
      }
    };
    const respGeneric = await run(req);
    const respLegacy = await client.sign(legacyReq);
    expect(!!respLegacy.err).to.equal(false, respLegacy.err);
    const genSig = `${respGeneric.sig.r.toString('hex')}${respGeneric.sig.s.toString('hex')}`;
    const legSig = `${respLegacy.sig.r.toString('hex')}${respLegacy.sig.s.toString('hex')}`;
    expect(genSig).to.equal(legSig, 'Legacy and generic requests produced different sigs.')
  });

  it('Should test random payloads', async () => {
    const numRandomReq = process.env.N || 5;
    for (let i = 0; i < numRandomReq; i++) {
      req.data.payload = helpers.prandomBuf(prng, fwConstants.genericSigning.baseDataSz);
      // 1. Secp256k1/keccak256
      req.data.curveType = Constants.SIGNING.CURVES.SECP256K1;
      req.data.hashType = Constants.SIGNING.HASHES.KECCAK256;
      await run(req);
      if (!continueTests) {
        return;
      }
      // 2. Secp256k1/sha256
      req.data.hashType = Constants.SIGNING.HASHES.SHA256;
      await run(req);
      if (!continueTests) {
        return;
      }
      // 3. Ed25519
      req.data.curveType = Constants.SIGNING.CURVES.ED25519;
      req.data.hashType = Constants.SIGNING.HASHES.NONE;
      req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
      await run(req);
      if (!continueTests) {
        return;
      }
    }
  })
})

describe('Solana Decoder', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        curveType: Constants.SIGNING.CURVES.ED25519,
        hashType: Constants.SIGNING.HASHES.NONE,
        encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
        payload: null,
      }
    };
  })

  it('Should test and validate Solana transaction encoding', async () => {
    // Build a Solana transaction with two signers, each derived from the Lattice's seed.
    // This will require two separate general signing requests, one per signer.

    // Get the full set of Solana addresses and keys
    // NOTE: Solana addresses are just base58 encoded public keys. We do not
    // currently support exporting of Solana addresses in firmware but we can
    // derive them here using the exported seed.
    const derivedAPath = JSON.parse(JSON.stringify(DEFAULT_SOLANA_SIGNER));
    const derivedBPath = JSON.parse(JSON.stringify(DEFAULT_SOLANA_SIGNER));
    derivedBPath[3] += 1;
    const derivedCPath = JSON.parse(JSON.stringify(DEFAULT_SOLANA_SIGNER));
    derivedCPath[3] += 2;
    const derivedA = helpers.deriveED25519Key(derivedAPath, seed);
    const derivedB = helpers.deriveED25519Key(derivedBPath, seed);
    const derivedC = helpers.deriveED25519Key(derivedCPath, seed);
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
    const randBuf = helpers.prandomBuf(prng, 32, true);
    const recentBlockhash = SolanaKeypair.fromSeed(randBuf).publicKey.toBase58();

    // Build a transaction and sign it using Solana's JS lib
    const txJs = new SolanaTransaction({ recentBlockhash }).add(transfer1, transfer2);
    txJs.setSigners(pubA, pubB);
    txJs.sign(SolanaKeypair.fromSeed(derivedA.priv), SolanaKeypair.fromSeed(derivedB.priv));
    const serTxJs = txJs.serialize().toString('hex');

    // Build a copy of the transaction and get the serialized payload for signing in firmware.
    const txFw = new SolanaTransaction({ recentBlockhash }).add(transfer1, transfer2);
    txFw.setSigners(pubA, pubB);
    // We want to sign the Solana message, not the full transaction
    const payload = txFw.compileMessage().serialize();

    // Sign payload from Lattice and add signatures to tx object
    req.data.signerPath = derivedAPath;
    req.data.payload = `0x${payload.toString('hex')}`;
    let resp = await run(req);
    if (!continueTests) {
      return;
    }
    const sigA = Buffer.from(
      `${resp.sig.r.toString('hex')}${resp.sig.s.toString('hex')}`,
      'hex'
    );
    req.data.signerPath = derivedBPath;
    resp = await run(req);
    const sigB = Buffer.from(
      `${resp.sig.r.toString('hex')}${resp.sig.s.toString('hex')}`,
      'hex'
    );
    txFw.addSignature(pubA, sigA);
    txFw.addSignature(pubB, sigB);

    // Validate the signatures from the Lattice match those of the Solana library
    const serTxFw = txFw.serialize().toString('hex');
    expect(serTxFw).to.equal(serTxJs, 'Signed tx mismatch');
  })
})

describe('Terra Decoder', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        signerPath: DEFAULT_TERRA_SIGNER,
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.SHA256,
        encodingType: Constants.SIGNING.ENCODINGS.TERRA,
        payload: null,
      }
    };
    terra = {
      // The Terra SDK is a little strange. We need to instantiate a client with
      // a known testnet, but we will be creating a static transaction that doesn't
      // use the testnet connection. We are just trying to create a signed transaction
      // and then validate Lattice signatures against the ones generated using
      // the Terra/Cosmos SDK
      client: new TerraClient({
        chainID: 'bombay-12',
        URL: 'https://bombay-lcd.terra.dev',
        gasPrices: { uluna: 0.38 },
      }),
      // A random nonce for state pruning or something?
      account_number: 111,
      // The account's nonce. Hilarious naming.
      sequence: 0,
    }
  })

  // Get a base account instance for the global seed at designated path
  function getTerraAccount(path) {
    const key = new TerraRawKey(helpers.deriveSECP256K1Key(path, seed).priv);
    const account = TerraBaseAccount.fromData({
      address: key.accAddress, 
      pub_key: key.publicKey.toData(), 
      account_number: terra.account_number, 
      sequence: terra.sequence,
    });
    const info = { 
      address: account.address, 
      publicKey: account.public_key,
      sequenceNumber: account.getSequenceNumber() 
    };
    return {
      key, account, info
    }
  }

  // A "signDoc" is used to build the payload
  function getSignDoc(signer, tx) {
    return new TerraSignDoc(
      terra.client.config.chainID,
      signer.account.getAccountNumber(),
      signer.account.getSequenceNumber(),
      tx.auth_info,
      tx.body
    );
  }

  // To get the payload, we create a sign doc and then overwrite
  // the 'signer_infos' param to get the bytes we need to sign.
  // https://github.com/terra-money/terra.js/blob/
  // 6fe2b2042e598842b5f99a93d929789a7a065b16/src/key/Key.ts#L94
  function getTerraPayload(signer, tx, isLegacy=false) {
    const signDoc = getSignDoc(signer, tx);
    if (isLegacy) {
      return Buffer.from(signDoc.toAminoJSON())
    }
    signDoc.auth_info.signer_infos = [
      new TerraSignerInfo(
        signer.account.public_key,
        signDoc.sequence,
        new TerraModeInfo(new TerraModeInfo.Single(
          TerraSignMode.SIGN_MODE_DIRECT
        ))
      )
    ];
    return signDoc.toBytes();
  }

  // Get a signature from terra.js to compare against Lattice sig
  async function getTerraJsSig(signer, tx, isLegacy=false) {
    const signDoc = getSignDoc(signer, tx);
    let _jsSig;
    if (isLegacy) {
      _jsSig = await signer.key.createSignatureAmino(signDoc);
    } else {
      _jsSig = await signer.key.createSignature(signDoc);
    }
    return Buffer.from(_jsSig.data.single.signature, 'base64');
  }

  it('Should decode MsgSend', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([TerraCoin.fromData({ amount: '23438', denomc: 'uusd' })]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const to = 'terra1f7m53lnz5w9arm2ks8jhqeuaphsu83lakmz4gr';
    const msgs = [
      new TerraMsgSend(
        signer.account.address,
        to,
        { uluna: 10000 },
      )
    ];
    const txData = { fee, msgs, timeoutHeight: 1000 };
    const tx = await terra.client.tx.create([ signer.info ], txData);
    req.data.payload = getTerraPayload(signer, tx);
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await run(req);
    const jsSig = await getTerraJsSig(signer, tx);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString('hex')}`;
    expect(latticeSig).to.equal(jsSig.toString('hex'), 'Sigs did not match')
  })

  it('Should decode MsgMultiSend', async () => {
    const path = JSON.parse(JSON.stringify(DEFAULT_TERRA_SIGNER));
    const signerA = getTerraAccount(path);
    path[4] = 1;
    const signerB = getTerraAccount(path);
    path[4] = 2;
    const signerC = getTerraAccount(path);
    const msgs = [
      new TerraMsgMultiSend([
        new TerraMsgMultiSend.Input(signerA.account.address, { uluna: 10000 }),
        new TerraMsgMultiSend.Input(signerB.account.address, { uluna: 10000 }),
      ], [
        new TerraMsgMultiSend.Output(signerC.account.address, { uluna: 20000 }),
      ]),
      new TerraMsgMultiSend([
        new TerraMsgMultiSend.Input(signerA.account.address, { uluna: 20000 }),
        new TerraMsgMultiSend.Input(signerB.account.address, { uluna: 20000 }),
      ], [
        new TerraMsgMultiSend.Output(signerC.account.address, { uluna: 40000 }),
      ])
    ];
    const txData = { msgs, fee: new TerraFee('10009999999999999'), timeoutHeight: 1000, };
    const tx = await terra.client.tx.create([ signerA.info, signerB.info ], txData);
    req.data.payload = getTerraPayload(signerA, tx);

    // Signer A
    const respA = await run(req);
    if (!continueTests) {
      return;
    }
    const jsSigA = await getTerraJsSig(signerA, tx);
    const latticeSigA = `${respA.sig.r.toString('hex')}${respA.sig.s.toString('hex')}`;
    expect(latticeSigA).to.equal(jsSigA.toString('hex'), 'Sigs did not match')
    // Signer B
    req.data.signerPath[4] = 1;
    req.data.payload = getTerraPayload(signerB, tx);
    const respB = await run(req);
    const jsSigB = await getTerraJsSig(signerB, tx);
    const latticeSigB = `${respB.sig.r.toString('hex')}${respB.sig.s.toString('hex')}`;
    expect(latticeSigB).to.equal(jsSigB.toString('hex'), 'Sigs did not match')
  })

  it('Should decode MsgExecuteContract' , async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([TerraCoin.fromData({ amount: '23438', denomc: 'uusd' })]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const to = 'terra1f7m53lnz5w9arm2ks8jhqeuaphsu83lakmz4gr';
    const msgs = [
      new TerraMsgExecuteContract(
        signer.account.address,
        to,
        {
          swap: {
            offer_asset: {
              amount: '1000000',
              info: {
                native_token: {
                  denom: 'uluna',
                },
              },
            },
          },
        },
        { uluna: 1000000 }
      )
    ];
    const txData = { fee, msgs };
    const tx = await terra.client.tx.create([ signer.info ], txData);
    req.data.payload = getTerraPayload(signer, tx);
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await run(req);
    const jsSig = await getTerraJsSig(signer, tx);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString('hex')}`;
    expect(latticeSig).to.equal(jsSig.toString('hex'), 'Sigs did not match')
  })

  it('Should fail decode unsupported message type but still decode the tx', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([TerraCoin.fromData({ amount: '23438', denomc: 'uusd' })]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const msgs = [
      // There are various message types that we do not decode, so while
      // we can decode the transaction, the message data display as raw bytes
      new TerraMsgSubmitProposal(
        new TerraParameterChangeProposal(
          'title',
          'description',
          [{ subspace: 'staking', key: 'MaxValidators', value: '130' }],
        ),
        { uluna: 10000 },
        signer.account.address,
      )
    ];
    const txData = { fee, msgs };
    const tx = await terra.client.tx.create([ signer.info ], txData);
    req.data.payload = getTerraPayload(signer, tx);
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await run(req);
    const jsSig = await getTerraJsSig(signer, tx);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString('hex')}`;
    expect(latticeSig).to.equal(jsSig.toString('hex'), 'Sigs did not match')
  });

  it('Should sign a legacy Amino payload without the decoder', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([TerraCoin.fromData({ amount: '23438', denomc: 'uusd' })]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const to = 'terra1f7m53lnz5w9arm2ks8jhqeuaphsu83lakmz4gr';
    const msgs = [
      new TerraMsgSend(
        signer.account.address,
        to,
        { uluna: 10000 },
      )
    ];
    const txData = { fee, msgs };
    const tx = await terra.client.tx.create([ signer.info ], txData);
    req.data.payload = getTerraPayload(signer, tx, true);
    req.data.encodingType = null;
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await run(req);
    const jsSig = await getTerraJsSig(signer, tx, true);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString('hex')}`;
    expect(latticeSig).to.equal(jsSig.toString('hex'), 'Sigs did not match')
  });
})
