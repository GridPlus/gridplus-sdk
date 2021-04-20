// Tests for ETH transaction edge cases
// NOTE: You must run the following BEFORE executing these tests:
//
// 1. Pair with the device once. This will ask you for your deviceID, which will
//    act as a salt for your pairing:
//
//    env REUSE_KEY=1 npm run test
//
// 2. Connect with the same deviceID you specfied in 1:
//
//    env DEVICE_ID='<your_device_id>' npm test
//
// After you do the above, you can run this test with `npm run test-eth`
//
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware
//        root CMakeLists.txt file (for dev units)
require('it-each')({ testPerIteration: true });
const randomWords = require('random-words');
const crypto = require('crypto');
const constants = require('./../src/constants')
const expect = require('chai').expect;
const helpers = require('./testUtil/helpers');
const seedrandom = require('seedrandom');
const prng = new seedrandom(process.env.SEED || 'myrandomseed');
const HARDENED_OFFSET = constants.HARDENED_OFFSET;
let client = null;
let numRandom = 20; // Number of random tests to conduct
const randomTxDataLabels = [];
const MSG_PAYLOAD_METADATA_SZ = 28;     // Metadata that must go in ETH_MSG requests
let ETH_GAS_PRICE_MAX;                  // value depends on firmware version
let foundError = false;

function randInt(n) {
  return Math.floor(n * prng.quick());
}

function buildIterLabels() {
  for (let i = 0; i < numRandom; i++)
    randomTxDataLabels.push({ label: `${i+1}/${numRandom}`, number: i })
}

function buildRandomMsg(type='signPersonal') {
  if (type === 'signPersonal') {
    // A random string will do
    const isHexStr = randInt(2) > 0 ? true : false;
    const fwConstants = constants.getFwVersionConst(client.fwVersion);
    const L = randInt(fwConstants.ethMaxDataSz - MSG_PAYLOAD_METADATA_SZ);
    if (isHexStr)
      return `0x${crypto.randomBytes(L).toString('hex')}`; // Get L hex bytes (represented with a string with 2*L chars)
    else
      return randomWords({ exactly: L, join: ' ' }).slice(0, L); // Get L ASCII characters (bytes)
  } else if (type === 'eip712') {
    return helpers.buildRandomEip712Object(randInt);
  }
}

function buildMsgReq(payload, protocol) {
  return {
    currency: 'ETH_MSG',
    data: {
      signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
      payload,
      protocol,
    }
  }
}

async function testMsg(req, pass=true) {
  try {
    const sig = await helpers.sign(client, req);
    // Validation happens already in the client
    if (pass === true) {
      foundError = sig.sig === null;
      expect(sig.sig).to.not.equal(null);
    } else {
      foundError = true;
      expect(sig.sig).to.equal(null);
    }
  } catch (err) {
    if (pass === true) {
      foundError = true;
      expect(err).to.equal(null);
    } else {
      foundError = err === null;
      expect(err).to.not.equal(null);
    }
  }
}

// Determine the number of random transactions we should build
if (process.env.N)
  numRandom = parseInt(process.env.N);
// Build the labels
buildIterLabels();

describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const connectErr = await helpers.connect(client, process.env.DEVICE_ID);
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    const fwConstants = constants.getFwVersionConst(client.fwVersion);
    ETH_GAS_PRICE_MAX = fwConstants.ethMaxGasPrice;
  });
})

describe('Test ETH personalSign', function() {
  beforeEach(() => {
    expect(foundError).to.equal(false, 'Error found in prior test. Aborting.');
  })

  it('Should throw error when message contains non-ASCII characters', async () => {
    const protocol = 'signPersonal';
    const msg = '⚠️';
    const msg2 = 'ASCII plus ⚠️';
    await testMsg(buildMsgReq(msg, protocol), false);
    await testMsg(buildMsgReq(msg2, protocol), false);
  })

  it('Should test ASCII buffers', async () => {
    await testMsg(buildMsgReq(Buffer.from('i am an ascii buffer'), 'signPersonal'), true);
    await testMsg(buildMsgReq(Buffer.from('{\n\ttest: foo\n}'), 'signPersonal'), false);
  })

  it('Should test hex buffers', async () => {
    await testMsg(buildMsgReq(Buffer.from('abcdef', 'hex'), 'signPersonal'), true);
  })

  it('Msg: sign_personal boundary conditions', async () => {
    const protocol = 'signPersonal';
    const fwConstants = constants.getFwVersionConst(client.fwVersion);
    const maxMsgSz = fwConstants.ethMaxMsgSz + (fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz);
    const maxValid = `0x${crypto.randomBytes(maxMsgSz).toString('hex')}`;
    const minInvalid = `0x${crypto.randomBytes(maxMsgSz + 1).toString('hex')}`;
    const zeroInvalid = '0x';
    await testMsg(buildMsgReq(maxValid, protocol), true);
    await testMsg(buildMsgReq(minInvalid, protocol), false);
    await testMsg(buildMsgReq(zeroInvalid, protocol), false);
  })

  it.each(randomTxDataLabels, 'Msg: sign_personal #%s', ['label'], async function(n, next) {
    const protocol = 'signPersonal';
    const payload = buildRandomMsg(protocol);
    try {
      await testMsg(buildMsgReq(payload, protocol))
      setTimeout(() => { next() }, 2000);
    } catch (err) {
      setTimeout(() => { next(err) }, 2000);
    }
  })

})

describe('Test ETH EIP712', function() {
  beforeEach(() => {
    expect(foundError).to.equal(false, 'Error found in prior test. Aborting.');
  })

  it('Should test canonical EIP712 example', async () => {
    const msg = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' }
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' }
        ]
      },
      primaryType: 'Mail',
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 12,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
      },
      message: {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
        },
        contents: 'foobar'
      }
    };
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        protocol: 'eip712',
        payload: msg,
      }
    }
    try {
      await helpers.sign(client, req);
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it('Should test canonical EIP712 example with 2nd level nesting', async () => {
    const msg = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Wallet: [
          { name: 'address', type: 'address' },
          { name: 'balance', type: 'uint256' },
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'Wallet' }
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' }
        ]
      },
      primaryType: 'Mail',
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 12,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
      },
      message: {
        from: {
          name: 'Cow',
          wallet: {
            address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            balance: '0x12345678',
          },
        },
        to: {
          name: 'Bob',
          wallet: {
            address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            balance: '0xabcdef12'
          },
        },
        contents: 'foobar'
      }
    };
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        protocol: 'eip712',
        payload: msg,
      }
    }
    try {
      await helpers.sign(client, req);
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it('Should test canonical EIP712 example with 3rd level nesting', async () => {
    const msg = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Wallet: [
          { name: 'address', type: 'address' },
          { name: 'balance', type: 'Balance' },
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'Wallet' }
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' }
        ],
        Balance: [
          { name: 'value', type: 'uint256' },
          { name: 'currency', type: 'string' }
        ]
      },
      primaryType: 'Mail',
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 12,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
      },
      message: {
        from: {
          name: 'Cow',
          wallet: {
            address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            balance: {
              value: '0x12345678',
              currency: 'ETH',
            }
          },
        },
        to: {
          name: 'Bob',
          wallet: {
            address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            balance: {
              value: '0xabcdef12',
              currency: 'UNI',
            },
          },
        },
        contents: 'foobar'
      }
    };
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        protocol: 'eip712',
        payload: msg,
      }
    }
    try {
      await helpers.sign(client, req);
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it('Should test canonical EIP712 example with 3rd level nesting and params in a different order', async () => {
    const msg = {
      types: {
        Balance: [
          { name: 'value', type: 'uint256' },
          { name: 'currency', type: 'string' }
        ],
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'Wallet' }
        ],
        Wallet: [
          { name: 'address', type: 'address' },
          { name: 'balance', type: 'Balance' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' }
        ],
      },
      primaryType: 'Mail',
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 12,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
      },
      message: {
        contents: 'foobar',
        from: {
          name: 'Cow',
          wallet: {
            address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            balance: {
              value: '0x12345678',
              currency: 'ETH',
            }
          },
        },
        to: {
          name: 'Bob',
          wallet: {
            address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
            balance: {
              value: '0xabcdef12',
              currency: 'UNI',
            },
          },
        },
      }
    };
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        protocol: 'eip712',
        payload: msg,
      }
    }
    try {
      await helpers.sign(client, req);
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it('Should test a bunch of EIP712 data types', async () => {
    const msg = {
      types: {
        EIP712Domain: [
          {
            name: 'name',
            type: 'string'
          },
          {
            name: 'version',
            type: 'string'
          },
          {
            name: 'chainId',
            type: 'uint256'
          },
          {
            name: 'verifyingContract',
            type: 'address'
          }
        ],
        PrimaryStuff: [
          { name: 'UINT8', type: 'uint8' },
          { name: 'UINT16', type: 'uint16' },
          { name: 'UINT32', type: 'uint32' },
          { name: 'UINT64', type: 'uint64' },
          { name: 'UINT256', type: 'uint256' },
          { name: 'BYTES1', type: 'bytes1' },
          { name: 'BYTES5', type: 'bytes5' },
          { name: 'BYTES7', type: 'bytes7' },
          { name: 'BYTES12', type: 'bytes12' },
          { name: 'BYTES16', type: 'bytes16' },
          { name: 'BYTES20', type: 'bytes20' },
          { name: 'BYTES21', type: 'bytes21' },
          { name: 'BYTES31', type: 'bytes31' },
          { name: 'BYTES32', type: 'bytes32' },
          { name: 'BYTES', type: 'bytes' },
          { name: 'STRING', type: 'string' },
          { name: 'BOOL', type: 'bool' },
          { name: 'ADDRESS', type: 'address' }
        ],
      },
      primaryType: 'PrimaryStuff',
      domain: {
        name: 'Muh Domainz',
        version: '1',
        chainId: 270,
        verifyingContract: '0xcc9c93cef8c70a7b46e32b3635d1a746ee0ec5b4'
      },
      'message': {
        UINT8: '0xab',
        UINT16: '0xb1d7',
        UINT32: '0x80bb335b',
        UINT64: '0x259528d5bc',
        UINT256: '0xad2693f24ba507750d1763ebae3661c07504',
        BYTES1: '0x2f',
        BYTES5: '0x9485269fa5',
        BYTES7: '0xc4e8d65ce8c3cf',
        BYTES12: '0x358eb7b28e8e1643e7c4737f',
        BYTES16: '0x7ace034ab088fdd434f1e817f32171a0',
        BYTES20: '0x4ab51f2d5bfdc0f1b96f83358d5f356c98583573',
        BYTES21: '0x6ecdc19b30c7fa712ba334458d77377b6a586bbab5',
        BYTES31: '0x06c21824a98643f96643b3220962f441210b007f4c19dfdf0dea53d097fc28',
        BYTES32: '0x59cfcbf35256451756b02fa644d3d0748bd98f5904febf3433e6df19b4df7452',
        BYTES: '0x0354b2c449772905b2598a93f5da69962f0444e0a6e2429e8f844f1011446f6fe81815846fb6ebe2d213968d1f8532749735f5702f565db0429b2fe596d295d9c06241389fe97fb2f3b91e1e0f2d978fb26e366737451f1193097bd0a2332e0bfc0cdb631005',
        STRING: 'I am a string hello there human',
        BOOL: true,
        ADDRESS: '0x078a8d6eba928e7ea787ed48f71c5936aed4625d',
      }
    }
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        protocol: 'eip712',
        payload: msg,
      }
    }
    try {
      await helpers.sign(client, req);
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it('Should test a payload that requires use of extraData frames', async () => {
    const msg = {
      'types': {
        'EIP712Domain': [
          {
            'name': 'name',
            'type': 'string'
          },
          {
            'name': 'version',
            'type': 'string'
          },
          {
            'name': 'chainId',
            'type': 'uint256'
          },
          {
            'name': 'verifyingContract',
            'type': 'address'
          }
        ],
        'Primary_Promote_room_donate_': [
          {
            'name': 'assist_dumb_bubble_g',
            'type': 'Open_either_fetch_gr'
          },
          {
            'name': 'jungle_symptom_meat_',
            'type': 'Unfair_device_vocal_'
          },
          {
            'name': 'buzz_attract_crater_',
            'type': 'Capital_junk_pet_dig'
          },
          {
            'name': 'achieve_twenty_found',
            'type': 'bytes24'
          },
          {
            'name': 'tent_cradle_bamboo_s',
            'type': 'bytes19'
          }
        ],
        'Open_either_fetch_gr': [
          {
            'name': 'afraid_three_silver_',
            'type': 'string'
          },
          {
            'name': 'two_wedding_author_a',
            'type': 'bytes2'
          },
          {
            'name': 'sudden_tail_exclude_',
            'type': 'bytes11'
          }
        ],
        'Unfair_device_vocal_': [
          {
            'name': 'feel_affair_curve_av',
            'type': 'bytes3'
          },
          {
            'name': 'deer_spoil_indicate_',
            'type': 'address'
          }
        ],
        'Capital_junk_pet_dig': [
          {
            'name': 'return_palace_flock_',
            'type': 'bytes32'
          },
          {
            'name': 'manage_cement_area_t',
            'type': 'bytes3'
          },
          {
            'name': 'pole_pluck_odor_circ',
            'type': 'Open_either_fetch_gr'
          }
        ]
      },
      'primaryType': 'Primary_Promote_room_donate_',
      'domain': {
        'name': 'Domain_Census_liberty_own_s',
        'version': '1',
        'chainId': {
          'type': 'BigNumber',
          'hex': '0x2207'
        },
        'verifyingContract': '0x52a3e01d76d2670f8fd452564b3f56eea6fc798d'
      },
      'message': {
        'assist_dumb_bubble_g': {
          'afraid_three_silver_': 'duck_acquire_chaos_rough_leader_merry_symptom_slab_tooth_bachelor_news_produce_bleak_young_skin_toot',
          'two_wedding_author_a': '0x9604',
          'sudden_tail_exclude_': '0xf996bed91579769e5bd995',
        },
        'jungle_symptom_meat_': {
          'feel_affair_curve_av': '0x4f493d',
          'deer_spoil_indicate_': '0x344b29a452b79bb8e4ef37f2c7688faafd0d2c7d'
        },
        'buzz_attract_crater_': {
          'return_palace_flock_': '0x93012c3a0c21d9adaaa3fb009f06a7bd90449b13df99096f1bdce9c48e16dbec',
          'manage_cement_area_t': '0x37b91f',
          'pole_pluck_odor_circ': {
            'afraid_three_silver_': 'author_never_range_boring_rabbit_meat_notable_excuse_attract_project_east_film_stay_twenty_cause_squ',
            'two_wedding_author_a': '0xf301',
            'sudden_tail_exclude_': '0xb5b5f8c2b5120c8aba2497',
          }
        },
        'achieve_twenty_found': '0xa5e8c0daacbf617191ec37b0cea3e23b15e4237935733d8c',
        'tent_cradle_bamboo_s': '0x4bd62f055b4a0ac7f52fe604bd7da4debdd291',
      }
    }
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        protocol: 'eip712',
        payload: msg,
      }
    }
    try {
      await helpers.sign(client, req);
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it.each(randomTxDataLabels, 'Msg: EIP712 #%s', ['label'], async function(n, next) {
    const protocol = 'eip712';
    const payload = buildRandomMsg(protocol);
    try {
      await testMsg(buildMsgReq(payload, protocol))
      setTimeout(() => { next() }, 2000);
    } catch (err) {
      console.log(JSON.stringify(payload, null, 2))
      setTimeout(() => { next(err) }, 2000);
    }
  })

})
