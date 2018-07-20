import assert from 'assert';
import { sha3, pubToAddress } from 'ethereumjs-util';
import secp256k1 from 'secp256k1';
import Client from '../src/index';

const SPLIT_BUF = '22222222222222222222222222222222';
const baseUrl = process.env.BASE_URL || 'http://localhost:80';

describe('integration tests', () => {

  describe('pairing', () => {

    it('should connect and get header key and pairing secret', (done) => {
      const client = new Client({ baseUrl });
      client.connect((err, res) => {
        if (err) return done(err);
        assert.notEqual(res.result, null);
        assert.notEqual(res.result, undefined);
        assert.notEqual(client.counter, null);
        assert.notEqual(client.counter, undefined);
        assert.notEqual(client.headerSecret, null);
        assert.notEqual(client.headerSecret, undefined);
        assert.notEqual(client.sharedSecret, null);
        assert.notEqual(client.sharedSecret, undefined);
        assert.equal(res.result.status, 200);
        done();
      });
    });

    it('should connect and pair an app', (done) => {
      const client = new Client({ baseUrl });
      // sut
      client.connect((err) => {
        if (err) return done(err);
        const name = 'my-app';
        // sut
        client.pair(name, (err, res) => {
          if (err) return done(err);
          assert.notEqual(res.id, null);
          assert.notEqual(res.id, undefined);
          assert.notEqual(res.result, null);
          assert.notEqual(res.result, undefined);
          assert.equal(res.result.message, 'Success');
          assert.equal(res.result.status, 200);
          assert.notEqual(res.result.data, null);
          assert.notEqual(res.result.data, undefined);
          assert.notEqual(res.result.data.newToken, null);
          assert.notEqual(res.result.data.newToken, undefined);
          assert.notEqual(res.result.data.newToken.ephemPublicKey, null);
          assert.notEqual(res.result.data.newToken.ephemPublicKey, undefined);
          assert.notEqual(res.result.data.newToken.counter, null);
          assert.notEqual(res.result.data.newToken.counter, undefined);
          done();
        });
      });
    });
  });

  describe('paired signing', () => {
    let client;

    beforeAll((done) => {
      client = new Client({ baseUrl });
      client.connect((err) => {
      if (err) return done(err);
        const name = 'my-app-2';
        client.pair(name, (err) => {
          if (err) return done(err);
          done(err);
        });
      });
    });

    it('should submit a permission request', (done) => {
      const req = {
        schemaIndex: 0,
        typeIndex: 0,
        rules: [
          null, null, null,
          null, null, null,
          null, null, null,
          'equals', '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb', null,
          'equals', 1000, null,
          'equals', '', null,
        ],
        timeLimit: 10000,
      };
      client.addPermission(req, (err, res) => {
        if (err) return done(err);
        assert.notEqual(res.id, null);
        assert.notEqual(res.id, undefined);
        assert.notEqual(res.result, null);
        assert.notEqual(res.result, undefined);
        assert.equal(res.result.message, 'Success');
        assert.equal(res.result.status, 200);
        assert.notEqual(res.result.data, null);
        assert.notEqual(res.result.data, undefined);
        assert.notEqual(res.result.data.newToken, null);
        assert.notEqual(res.result.data.newToken, undefined);
        assert.notEqual(res.result.data.newToken.ephemPublicKey, null);
        assert.notEqual(res.result.data.newToken.ephemPublicKey, undefined);
        assert.notEqual(res.result.data.newToken.counter, null);
        assert.notEqual(res.result.data.newToken.counter, undefined);
        assert.equal(res.result.data.count, 1);
        done();
      });
    });

    it('should get the address of the account associated with the permission', (done) => {
      const req = { permissionIndex: 0, isManual: false, coin_type: '60\'' };
      client.addresses(req, (err, res) => {
        if (err) return done(err);
        assert.notEqual(res.id, null);
        assert.notEqual(res.id, undefined);
        assert.notEqual(res.result, null);
        assert.notEqual(res.result, undefined);
        assert.equal(res.result.message, 'Success');
        assert.equal(res.result.status, 200);
        assert.notEqual(res.result.data, null);
        assert.notEqual(res.result.data, undefined);
        assert.notEqual(res.result.data.newToken, null);
        assert.notEqual(res.result.data.newToken, undefined);
        assert.notEqual(res.result.data.newToken.ephemPublicKey, null);
        assert.notEqual(res.result.data.newToken.ephemPublicKey, undefined);
        assert.notEqual(res.result.data.newToken.counter, null);
        assert.notEqual(res.result.data.newToken.counter, undefined);
        assert.notEqual(res.result.data.addresses, null);
        assert.notEqual(res.result.data.addresses, undefined);
        done();
      });
    });

    it('should make a remote signing request', (done) => {
      const req = { permissionIndex: 0, isManual: false, coin_type: '60\'' };
      // grab address to perform comparison in signAutomated
      client.addresses(req, (err, res) => {
        if (err) return done(err);

        const permAddr = res.result.data.addresses;

        const req = {
          schemaIndex: 0,
          typeIndex: 0,
          params: [1, 100000000, 100000, '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb', 1000, ''],
        };
        // sut
        client.signAutomated(req, (err, res) => {
          if (err) return done(err);
          assert.notEqual(res.id, null);
          assert.notEqual(res.id, undefined);
          assert.notEqual(res.result, null);
          assert.notEqual(res.result, undefined);
          assert.equal(res.result.message, 'Success');
          assert.equal(res.result.status, 200);
          assert.notEqual(res.result.data, null);
          assert.notEqual(res.result.data, undefined);
          assert.notEqual(res.result.data.newToken, null);
          assert.notEqual(res.result.data.newToken, undefined);
          assert.notEqual(res.result.data.newToken.ephemPublicKey, null);
          assert.notEqual(res.result.data.newToken.ephemPublicKey, undefined);
          assert.notEqual(res.result.data.newToken.counter, null);
          assert.notEqual(res.result.data.newToken.counter, undefined);
          assert.notEqual(res.result.data.sigData, null);
          assert.notEqual(res.result.data.sigData, undefined);
          // The message includes the preImage payload concatenated to a signature,
          // separated by a standard string/buffer
          const sigData = res.result.data.sigData.split(SPLIT_BUF);
          const preImage = Buffer.from(sigData[0], 'hex');
          const msg = sha3(preImage);
          const sig = sigData[1];
          // Deconstruct the signature and ensure the signer is the key associated
          // with the permission
          const sr = Buffer.from(sig.substr(0, sig.length - 1), 'hex');
          const v = parseInt(sig.slice(-1));
          const signer = secp256k1.recover(msg, sr, v, false);
          assert.equal(`0x${  pubToAddress(signer.slice(1)).toString('hex')}`, permAddr, 'Incorrect signature');
          done();
        });
      });
    });
  });

  describe('manual signing', () => {
    let mqttMessagingClient;

    beforeAll((done) => {
      mqttMessagingClient = new Client({ baseUrl });
      mqttMessagingClient.connect((err) => {
        if (err) return done(err);
        const name = 'my-app-2';
        mqttMessagingClient.pair(name, (err) => {
          if (err) return done(err);
          done(err);
        });
      });
    });

    it('should create a new read-only/manual permission', (done) => {
      mqttMessagingClient.addManualPermission((err, res) => {
        if (err) return done(err);
        assert.notEqual(res.id, null);
        assert.notEqual(res.id, undefined);
        assert.notEqual(res.result, null);
        assert.notEqual(res.result, undefined);
        assert.equal(res.result.message, 'Success');
        assert.equal(res.result.status, 200);
        assert.notEqual(res.result.data, null);
        assert.notEqual(res.result.data, undefined);
        assert.notEqual(res.result.data.newToken, null);
        assert.notEqual(res.result.data.newToken, undefined);
        assert.notEqual(res.result.data.newToken.ephemPublicKey, null);
        assert.notEqual(res.result.data.newToken.ephemPublicKey, undefined);
        assert.notEqual(res.result.data.newToken.counter, null);
        assert.notEqual(res.result.data.newToken.counter, undefined);
        assert.equal(res.result.data.count, 1);
        done();
      });
    });

    it('should request a manual signature', (done) => {
      const req = {
        schemaIndex: 0,
        typeIndex: 0,
        rules: [
          null, null, null,
          null, null, null,
          null, null, null,
          'equals', '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb', null,
          'equals', 1000, null,
          'equals', '', null,
        ],
        timeLimit: 10000,
      };
      // add permission, so we can grab an address
      mqttMessagingClient.addPermission(req, (err) => {
        if (err) return done(err);

        const req = { permissionIndex: 0, isManual: false, coin_type: '60\'' };
        // grab address to perform comparison in signAutomated
        mqttMessagingClient.addresses(req, (err, res) => {
          if (err) return done(err);

          const permAddr = res.result.data.addresses;

          const req = {
            schemaIndex: 0,
            typeIndex: 0,
            params: [1, 100000000, 100000, '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb', 1000, ''],
          };
          // sut
          mqttMessagingClient.signManual(req, (err, res) => {
            if (err) return done(err);
            assert.notEqual(res.id, null);
            assert.notEqual(res.id, undefined);
            assert.notEqual(res.result, null);
            assert.notEqual(res.result, undefined);
            assert.equal(res.result.message, 'Success');
            assert.equal(res.result.status, 200);
            assert.notEqual(res.result.data, null);
            assert.notEqual(res.result.data, undefined);
            assert.notEqual(res.result.data.newToken, null);
            assert.notEqual(res.result.data.newToken, undefined);
            assert.notEqual(res.result.data.newToken.ephemPublicKey, null);
            assert.notEqual(res.result.data.newToken.ephemPublicKey, undefined);
            assert.notEqual(res.result.data.newToken.counter, null);
            assert.notEqual(res.result.data.newToken.counter, undefined);
            // The message includes the preImage payload concatenated to a signature,
            // separated by a standard string/buffer
            const sigData = res.result.data.sigData.split(SPLIT_BUF);
            const preImage = Buffer.from(sigData[0], 'hex');
            const msg = sha3(preImage);
            const sig = sigData[1];
            // Deconstruct the signature and ensure the signer is the key associated
            // with the permission
            const sr = Buffer.from(sig.substr(0, sig.length - 1), 'hex');
            const v = parseInt(sig.slice(-1));
            const signer = secp256k1.recover(msg, sr, v, false);
            assert.equal(`0x${pubToAddress(signer.slice(1)).toString('hex')}`, permAddr, 'Incorrect signature');
            done();
          });
        });
      });
    });
  });

});
