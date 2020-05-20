const crypto = require('crypto');
const Sdk = require('../../index.js');

function setupTestClient(env) {
  const setup = {
      name: 'SDK Test',
      baseUrl: 'https://signing.staging-gridpl.us',
      crypto,
      timeout: 120000,
    };
    const REUSABLE_KEY = '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca;'
    // If the user passes a deviceID in the env, we assume they have previously
    // connected to the Lattice.
    if (env.DEVICE_ID) {
      setup.privKey = Buffer.from(REUSABLE_KEY, 'hex');
    }
    // Separate check -- if we are connecting for the first time but want to be able
    // to reconnect quickly with the same device ID as an env var, we need to pair
    // with a reusable key
    if (parseInt(env.REUSE_KEY) === 1) {
      setup.privKey = Buffer.from(REUSABLE_KEY, 'hex');
    }
    // Initialize a global SDK client
    const client = new Sdk.Client(setup);
    return client;
}

function connect(client, id) {
  return new Promise((resolve) => {
    client.connect(id, (err) => {
      return resolve(err);
    })
  })
}

function pair(client, secret) {
  return new Promise((resolve) => {
    client.pair(secret, (err) => {
      return resolve(err);
    })
  })
}

function getAddresses(client, opts, timeout=0) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      client.getAddresses(opts, (err, res) => {
        if (err) return reject(err);
        return resolve(res);
      })
    }, timeout);
  })
}

function sign(client, opts) {
  return new Promise((resolve, reject) => {
    client.sign(opts, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    })
  })
}

exports.setupTestClient = setupTestClient;
exports.connect = connect;
exports.pair = pair;
exports.getAddresses = getAddresses;
exports.sign = sign;