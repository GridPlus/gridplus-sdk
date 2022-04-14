import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { serialize } from 'borsh';
import { KeyPair, transactions as NEAR } from 'near-api-js';
import { HARDENED_OFFSET } from '../../src/constants'
import { Constants } from '../../src/index'
import { randomBytes } from '../../src/util'
let test, signer;

//---------------------------------------
// STATE DATA
//---------------------------------------
const DEFAULT_NEAR_SIGNER = [
  HARDENED_OFFSET + 44, HARDENED_OFFSET + 397, HARDENED_OFFSET, HARDENED_OFFSET
];
// Random but static blockhash
const blockhash = Buffer.from(
  '087781ed7097ed7f00d734f9a2708b435e4b762bbd9cc9f82457dadcae281354',
  'hex'
);
const signerId = 'signer.near';
const receiverId = 'receiver.near';
let req;

//---------------------------------------
// TESTS
//---------------------------------------
describe('Start NEAR signing tests', () => {
  test = global.test;
  test.continue = true;
})

describe('[NEAR]', () => {
  beforeEach(() => {
    test.expect(test.continue).to.equal(true, 'Error in previous test.');
    test.continue = false;
  })
 
  it('Should test CreateAccount', async () => {
    const actions = [
      NEAR.createAccount(),
    ];
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });

  it('Should test DeployContract', async () => {
    const actions = [
      NEAR.deployContract(randomBytes(512)),
    ];
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });

  it('Should test FunctionCall', async () => {
    const actions = [
      NEAR.functionCall(
        'methodName',     // method name
        randomBytes(96),  // args
        12345,            // gas (u64)
        100000            // deposit (u128)  
      ),
    ]
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });

  it('Should test Transfer', async () => {
    const actions = [
      NEAR.transfer(2),
    ];
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  })

  it('Should test Stake', async () => {
    const signer = getKeyPair(DEFAULT_NEAR_SIGNER);
    const actions = [
      NEAR.stake(
        100000,           // stake (u128)
        signer.publicKey, // pubkey
      )
    ];
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });

  it('Should test AddKey', async () => {
    const fullAccessKey = new NEAR.AccessKey({ 
      nonce: 5, 
      permission: new NEAR.AccessKeyPermission({ 
        fullAccess: new NEAR.FullAccessPermission({}) 
      }) 
    });
    const functionCallAccessKey = new NEAR.AccessKey({ 
      nonce: 3, 
      permission: new NEAR.AccessKeyPermission({ 
        functionCall: new NEAR.FunctionCallPermission({ 
          receiverId: 'mycontract.near',          // contract address
          methodNames: [ 'method1', 'method2' ],  // callable methods in this function
        }) 
      }) 
    });
    const functionCallAccessKeyWithAllowance = new NEAR.AccessKey({ 
      nonce: 3, 
      permission: new NEAR.AccessKeyPermission({ 
        functionCall: new NEAR.FunctionCallPermission({ 
          allowance: 22222222,                    // amount that can be spent (u128)
          receiverId: 'mycontract.near',          // contract address
          methodNames: [ 'method1', 'method2' ],  // callable methods in this function
        }) 
      }) 
    });

    const newKey = getKeyPair(getSignerPath(1));
    // We will be creating an account with two different permission types
    // 1. Full access
    const fullAccessActions = [
      NEAR.addKey(
        newKey.publicKey,
        fullAccessKey,
      )
    ];
    await testSig(fullAccessActions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    // 2. Access limited to a given allowance, contract address, and specific functions
    const funcCallAccessActions = [
      NEAR.addKey(
        newKey.publicKey,
        functionCallAccessKey,
      )
    ];
    await testSig(funcCallAccessActions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    const funcCallAccessActionsWithAllowance = [
      NEAR.addKey(
        newKey.publicKey,
        functionCallAccessKeyWithAllowance,
      )
    ];
    await testSig(funcCallAccessActionsWithAllowance, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });
  it('Should test DeleteKey', async () => {
    const newKey = getKeyPair(getSignerPath(1));
    const actions = [
      NEAR.deleteKey(newKey.publicKey),
    ];
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });
  
  it('Should test DeleteAccount', async () => {
    const actions = [
      NEAR.deleteAccount('beneficiaryId.near'),
    ];
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  });
  
  it('Should test CreateAccount action combo', async () => {
    // Create an account at the next signer index
    const newAccountPath = getSignerPath(1);
    const newKey = getKeyPair(newAccountPath);
    // Assemble the actions that will comprise this transaction
    const actions = [
      NEAR.createAccount(),
      NEAR.transfer(1000),
      NEAR.addKey(newKey.publicKey, NEAR.fullAccessKey()),
    ]
    await testSig(actions, DEFAULT_NEAR_SIGNER, signerId, receiverId);
    test.continue = true;
  })

})

function getSignerPath(idx) {
  const path = JSON.parse(JSON.stringify(DEFAULT_NEAR_SIGNER));
  path[path.length - 1] += idx;
  return path;
}

function getKeyPair(path) {
  // Normally we would just export the priv, but NEAR's lib requires we
  // use a nacl secret key, so we build one from "seed", where the seed
  // is just a private key.
  // NOTE: ED25519 "secret key" is just concatenated `priv | pub`
  //       You can test this yourself by exporting `pub` from `deriveED25519Key`
  //       and printing `priv`, `pub`, and `kp.secretKey`.
  const { priv } = test.helpers.deriveED25519Key(path, test.seed, true);
  const kp = nacl.sign.keyPair.fromSeed(priv);
  return KeyPair.fromString(bs58.encode(kp.secretKey));
}

function coerceLatticeSig(resp) {
  return Buffer.concat([resp.sig.r, resp.sig.s]);
}

async function testSig(actions, signerPath, signerId, receiverId) {
  const signer = getKeyPair(signerPath);
  // Build the transaction, convert it to a signable message, and
  // compare a Lattice sig with a reference JS sig using NEAR's SDK
  const tx = NEAR.createTransaction(
    signerId, signer.publicKey, receiverId, 123, actions, blockhash
  );
  const msg = serialize(NEAR.SCHEMA, tx);
  const jsSig = Buffer.from(signer.sign(msg).signature);
  const req = {
    data: {
      signerPath,
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.NEAR,
      payload: msg,
    }
  };

  const latticeSig = coerceLatticeSig(await test.client.sign(req));
  test.expect(latticeSig.toString('hex')).to.equal(
    jsSig.toString('hex'), 
    'Sig does not match'
  );
}