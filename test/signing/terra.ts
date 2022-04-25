import {
  BaseAccount as TerraBaseAccount,
  Coin as TerraCoin,
  Coins as TerraCoins,
  Fee as TerraFee,
  LCDClient as TerraClient,
  ModeInfo as TerraModeInfo,
  MsgExecuteContract as TerraMsgExecuteContract,
  MsgMultiSend as TerraMsgMultiSend,
  MsgSend as TerraMsgSend,
  MsgSubmitProposal as TerraMsgSubmitProposal,
  ParameterChangeProposal as TerraParameterChangeProposal,
  RawKey as TerraRawKey,
  SignDoc as TerraSignDoc,
  SignerInfo as TerraSignerInfo,
} from '@terra-money/terra.js';
import { SignMode as TerraSignMode } from '@terra-money/terra.proto/cosmos/tx/signing/v1beta1/signing';
import { HARDENED_OFFSET } from '../../src/constants';
import { Constants } from '../../src/index';
let test;

//---------------------------------------
// STATE DATA
//---------------------------------------
const DEFAULT_TERRA_SIGNER = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 330,
  HARDENED_OFFSET,
  0,
  0,
];
let req, terra;
describe('Start Terra signing tests', () => {
  test = global.test;
});

//---------------------------------------
// TESTS
//---------------------------------------
describe('[Terra]', () => {
  beforeEach(() => {
    test.expect(test.continue).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        signerPath: DEFAULT_TERRA_SIGNER,
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.SHA256,
        encodingType: Constants.SIGNING.ENCODINGS.TERRA,
        payload: null,
      },
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
    };
  });

  // Get a base account instance for the global seed at designated path
  function getTerraAccount(path) {
    const key = new TerraRawKey(
      test.helpers.deriveSECP256K1Key(path, test.seed).priv,
    );
    const account = TerraBaseAccount.fromData({
      address: key.accAddress,
      pub_key: key.publicKey.toData(),
      account_number: terra.account_number,
      sequence: terra.sequence,
    });
    const info = {
      address: account.address,
      publicKey: account.public_key,
      sequenceNumber: account.getSequenceNumber(),
    };
    return {
      key,
      account,
      info,
    };
  }

  // A "signDoc" is used to build the payload
  function getSignDoc(signer, tx) {
    return new TerraSignDoc(
      terra.client.config.chainID,
      signer.account.getAccountNumber(),
      signer.account.getSequenceNumber(),
      tx.auth_info,
      tx.body,
    );
  }

  // To get the payload, we create a sign doc and then overwrite
  // the 'signer_infos' param to get the bytes we need to sign.
  // https://github.com/terra-money/terra.js/blob/
  // 6fe2b2042e598842b5f99a93d929789a7a065b16/src/key/Key.ts#L94
  function getTerraPayload (signer, tx, isLegacy = false) {
    const signDoc = getSignDoc(signer, tx);
    if (isLegacy) {
      return Buffer.from(signDoc.toAminoJSON());
    }
    signDoc.auth_info.signer_infos = [
      new TerraSignerInfo(
        signer.account.public_key,
        signDoc.sequence,
        new TerraModeInfo(
          new TerraModeInfo.Single(TerraSignMode.SIGN_MODE_DIRECT),
        ),
      ),
    ];
    return signDoc.toBytes();
  }

  // Get a signature from terra.js to compare against Lattice sig
  async function getTerraJsSig (signer, tx, isLegacy = false) {
    const signDoc = getSignDoc(signer, tx);
    let _jsSig;
    if (isLegacy) {
      _jsSig = await signer.key.createSignatureAmino(signDoc);
    } else {
      _jsSig = await signer.key.createSignature(signDoc);
    }
    return Buffer.from(_jsSig.data.single.signature, 'base64');
  }

  it('Should test address derivations', async () => {
    const path = req.data.signerPath;
    for (let i = 0; i < 5; i++) {
      path[4] += i;
      const jsAccount = getTerraAccount(req.data.signerPath);
      const jsPub = Buffer.from(jsAccount.account.public_key.key, 'base64').toString('hex');
      const latticePubs = await test.client.getAddresses({
        startPath: DEFAULT_TERRA_SIGNER,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      })
      const latticePub = test.helpers.compressPubKey(latticePubs[0]).toString('hex');
      test.expect(latticePub).to.equal(jsPub, 'Pubkeys did not match');
    }
  })

  it('Should decode MsgSend', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([
      TerraCoin.fromData({ amount: '23438', denomc: 'uusd' }),
    ]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const to = 'terra1f7m53lnz5w9arm2ks8jhqeuaphsu83lakmz4gr';
    const msgs = [
      new TerraMsgSend(signer.account.address, to, { uluna: 10000 }),
    ];
    const txData = { fee, msgs, timeoutHeight: 1000 };
    const tx = await terra.client.tx.create([signer.info], txData);
    req.data.payload = getTerraPayload(signer, tx);
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await test.runGeneric(req, test);
    const jsSig = await getTerraJsSig(signer, tx);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString(
      'hex',
    )}`;
    test
      .expect(latticeSig)
      .to.equal(jsSig.toString('hex'), 'Sigs did not match');
  });

  it('Should decode MsgMultiSend', async () => {
    const path = JSON.parse(JSON.stringify(DEFAULT_TERRA_SIGNER));
    const signerA = getTerraAccount(path);
    path[4] = 1;
    const signerB = getTerraAccount(path);
    path[4] = 2;
    const signerC = getTerraAccount(path);
    const msgs = [
      new TerraMsgMultiSend(
        [
          new TerraMsgMultiSend.Input(signerA.account.address, {
            uluna: 10000,
          }),
          new TerraMsgMultiSend.Input(signerB.account.address, {
            uluna: 10000,
          }),
        ],
        [
          new TerraMsgMultiSend.Output(signerC.account.address, {
            uluna: 20000,
          }),
        ],
      ),
      new TerraMsgMultiSend(
        [
          new TerraMsgMultiSend.Input(signerA.account.address, {
            uluna: 20000,
          }),
          new TerraMsgMultiSend.Input(signerB.account.address, {
            uluna: 20000,
          }),
        ],
        [
          new TerraMsgMultiSend.Output(signerC.account.address, {
            uluna: 40000,
          }),
        ],
      ),
    ];
    const txData = {
      msgs,
      fee: new TerraFee('10009999999999999'),
      timeoutHeight: 1000,
    };
    const tx = await terra.client.tx.create(
      [signerA.info, signerB.info],
      txData,
    );
    req.data.payload = getTerraPayload(signerA, tx);

    // Signer A
    const respA = await test.runGeneric(req, test);
    if (!test.continue) {
      return;
    }
    const jsSigA = await getTerraJsSig(signerA, tx);
    const latticeSigA = `${respA.sig.r.toString('hex')}${respA.sig.s.toString(
      'hex',
    )}`;
    test
      .expect(latticeSigA)
      .to.equal(jsSigA.toString('hex'), 'Sigs did not match');
    // Signer B
    req.data.signerPath[4] = 1;
    req.data.payload = getTerraPayload(signerB, tx);
    const respB = await test.runGeneric(req, test);
    const jsSigB = await getTerraJsSig(signerB, tx);
    const latticeSigB = `${respB.sig.r.toString('hex')}${respB.sig.s.toString(
      'hex',
    )}`;
    test
      .expect(latticeSigB)
      .to.equal(jsSigB.toString('hex'), 'Sigs did not match');
  });

  it('Should decode MsgExecuteContract', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([
      TerraCoin.fromData({ amount: '23438', denomc: 'uusd' }),
    ]);
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
        { uluna: 1000000 },
      ),
    ];
    const txData = { fee, msgs };
    const tx = await terra.client.tx.create([signer.info], txData);
    req.data.payload = getTerraPayload(signer, tx);
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await test.runGeneric(req, test);
    const jsSig = await getTerraJsSig(signer, tx);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString(
      'hex',
    )}`;
    test
      .expect(latticeSig)
      .to.equal(jsSig.toString('hex'), 'Sigs did not match');
  });

  it('Should fail decode unsupported message type but still decode the tx', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([
      TerraCoin.fromData({ amount: '23438', denomc: 'uusd' }),
    ]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const msgs = [
      // There are various message types that we do not decode, so while
      // we can decode the transaction, the message data display as raw bytes
      new TerraMsgSubmitProposal(
        new TerraParameterChangeProposal('title', 'description', [
          { subspace: 'staking', key: 'MaxValidators', value: '130' },
        ]),
        { uluna: 10000 },
        signer.account.address,
      ),
    ];
    const txData = { fee, msgs };
    const tx = await terra.client.tx.create([signer.info], txData);
    req.data.payload = getTerraPayload(signer, tx);
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await test.runGeneric(req, test);
    const jsSig = await getTerraJsSig(signer, tx);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString(
      'hex',
    )}`;
    test
      .expect(latticeSig)
      .to.equal(jsSig.toString('hex'), 'Sigs did not match');
  });

  it('Should sign a legacy Amino payload without the decoder', async () => {
    // Get signer account
    const signer = getTerraAccount(req.data.signerPath);
    // Construct tx
    const gasCoins = new TerraCoins([
      TerraCoin.fromData({ amount: '23438', denomc: 'uusd' }),
    ]);
    const estimatedGas = 156249;
    const fee = new TerraFee(estimatedGas, gasCoins);
    const to = 'terra1f7m53lnz5w9arm2ks8jhqeuaphsu83lakmz4gr';
    const msgs = [
      new TerraMsgSend(signer.account.address, to, { uluna: 10000 }),
    ];
    const txData = { fee, msgs };
    const tx = await terra.client.tx.create([signer.info], txData);
    req.data.payload = getTerraPayload(signer, tx, true);
    req.data.encodingType = null;
    // Get signature from Lattice and compare to Terra.js sig from derived key
    const resp = await test.runGeneric(req, test);
    const jsSig = await getTerraJsSig(signer, tx, true);
    const latticeSig = `${resp.sig.r.toString('hex')}${resp.sig.s.toString(
      'hex',
    )}`;
    test
      .expect(latticeSig)
      .to.equal(jsSig.toString('hex'), 'Sigs did not match');
  });
});
