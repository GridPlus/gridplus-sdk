const crypto = require('crypto');
const EC = require('elliptic').ec;
const EC_K = new EC('secp256k1');
const request = require('superagent');
const config = require('./config.js');
const bitcoin = require('./src/blockchain/bitcoin.js');
const ethereum = require('./src/blockchain/ethereum.js');
const util = require('./src/util.js');
const AgentRestClient = require('@gridplus/agent-rest-client').default;
const DEFAULT_COUNTER = 5;

class GridPlusSDK extends AgentRestClient{
  //============================================================================
  // SETUP OBJECT
  //============================================================================
  constructor({ url = config.api.baseUrl, name = 'app-0', privKey = crypto.randomBytes(32) } = {}) {
    super({ baseUrl: url, privKey });
    // Create a keypair either with existing entropy or system-based randomness
    // this._initKeyPair(opts);
    this.headerSecret = null;
    this.name = opts.name ? opts.name : 'app-0';
    // If an ETH provider is included in opts, connect to the provider automatically
    if (opts.ethProvider !== undefined) this.connectToEth(opts.ethProvider);
  }

  //============================================================================
  // FUNCTIONALITY TO INTERACT WITH VARIOUS BLOCKCHAINS
  // We need to query both Bitcoin and Ethereum blockchains to get relevent
  // account data. This means connecting to nodes
  //============================================================================
  
  // Initialize a connection to an Ethereum node. 
  // @param [provider] {string} - of form `${protocol}://${host}:${port}`, where `protocol` is 'ws' or 'http'
  // @returns          {Error}  - may be null
  connectToEth(provider=null) {
    if (provider === null) return ethereum.initEth()
    else                   return ethereum.initEth(provider)
  }

  // Initialize a connection to Bitcoin node. 
  // @param [options] {object}
  // @returns         {Promise}
  connectToBtc(options={}) {
    return bitcoin.initBitcoin(options)
  }

  // Get the web3 connection for advanced functionality
  getProvider() {
    return ethereum.getProvider();
  }

  // Get a balance for an account. RETURNS A PROMISE!
  // @param [currency]  {string}  - "ETH", "ERC20", or "BTC"
  // @param [addr]      {string}  - The account we are querying
  // @param [ERC20Addr] {string}  - (optional) Address of the ERC20 token we are asking about
  // @returns           {Promise} - Contains the balance in full units (i.e. with decimals divided in)
  getBalance(currency, addr, ERC20Addr=null) {
    switch(currency) {
      case 'BTC':
        return bitcoin.getBalance(addr);
        break;
      case 'ETH': 
        return ethereum.getBalance(addr);
        break;
      case 'ERC20':
        return ethereum.getBalance(addr, ERC20Addr);
        break;
      default:
        return;
        break;
    }
  }

  // Get a history of transfers for the desired currency. RETURNS A PROMISE!
  // @param [currency]  {string}  - "ETH", "ERC20", or "BTC"
  // @param [addr]      {string}  - The account we are querying
  // @param [ERC20Addr] {string}  - (optional) Address of the ERC20 token we are asking about
  // @returns           {Promise} - Contains an object of form: { in: <Array> , out: <Array> }
  //                                See API documentation for schema of the nested arrays.
  getTransactionHistory(currency, user, ERC20Addr=null) {
    switch(currency) {
      case 'ETH':
        return []; // Todo, need to figure out a way to pull in simple transfers
        break;
      case 'ERC20':
        return ethereum.getERC20TransferHistory(user, ERC20Addr);
        break;
      default:
        return;
        break;
    }
  }

  // Get the number of transactions an address has made. This is needed for building ETH
  // transactions and may be useful for BTC as well
  // @param [system]  {string}  - "ETH" or "BTC"
  // @param [user]    {string}  - Account we are querying
  // @returns         {Promise} - Contains a number
  getTransactionCount(system, user) {
    switch (system) {
      case 'ETH':
        return ethereum.getNonce(user);
        break;
      default:
        return;
        break;
    }
  }

  //============================================================================
  // COMMS WITH AGENT
  //============================================================================

  // Initiate comms with a particular agent
  connect(serial, url=config.api.baseUrl) {
    return new Promise((resolve, reject) => {
      // First connect to the API
      const ecdhPub = this.ecdhKey.getPublic().encode('hex');
      request.get(url)
      .then((res) => {
        if (!res.body) return reject(`Could not connect to API at ${url}`)
        else if (res.status !== 200) return reject(`Could not connect to API at ${url}`)
        this.url = url;
        return;
      })
      .then(() => {
        return request.post(`${url}/connect`).send({ key: ecdhPub });
      })
      .then((res) => {
        if (!res.body) return reject(`Could not connect to agent ${serial}`)
        else if (res.status !== 200) return reject(`Could not connect to agent ${serial}`)
        else if (res.body.key != ecdhPub) return reject(`connect response returned wrong ECDH key: ${res.body.key}`)
        // Generate a header secret using the returned headerKey and your ECDH key
        this.headerSecret = util.deriveSecret(this.privKey, res.body.result.headerKey);
        this._setNewUsageToken(res.body.result.newToken);
        return resolve(res.body);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }

  // Generate an app secret. This should be displayed by your app and typed into the agent
  genSecret() {
    this.appSecret = crypto.randomBytes(8).toString('hex');
    return this.appSecret;
  }

  pair() {
    return new Promise((resolve, reject) => {
      const preImage = `${this.tmpSharedSecret}${this.appSecret}`;
      const msg = crypto.createHash('sha256').update(preImage).digest();
      const data = {
        name: this.name,
        sig: this.ecdsaKey.sign(msg).toDER(),
      };
      this._agentRequest('addPairing', data)
      .then((res) => {
        return resolve(res)
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }

/*
  // Create an EC keypair. Optionally, a passphrase may be provided as opts.entropy
  _initKeyPair(opts) {
    this.privKey = opts.privKey ? opts.privKey : crypto.randomBytes(32).toString('hex');
    // Generate ECDH key for encrypting/decrypting outer requests
    const ECDH = new EC('curve25519');
    this.ecdhKey = ECDH.keyFromPrivate(this.privKey, 'hex');
    // Generate ECDSA key for signing
    const ECDSA = new EC('secp256k1');
    this.ecdsaKey = ECDSA.keyFromPrivate(this.privKey, 'hex');
  }
*/
  _setNewUsageToken(_token) {
    // NOTE: DEFAULT_COUNTER is used here with the header secret. Ideally, we could
    // rotate the counter every time the header key is used, but it's fine to be
    // constant for now
    const dec = util.decrypt(this.headerSecret, _token, DEFAULT_COUNTER);
    const token = JSON.parse(dec);
    this.tmpSharedSecret = util.deriveSecret(this.privKey, token.data.ephemPublicKey, token.data.counter);
  }

  // Decrypt a new usage token
  _unpackUsageToken(token) {

  }

  // Send a request and capture the new shared secret
  _agentRequest(route, data) {
    return new Promise((resolve, reject) => {
      // First, encrypt req.body.data if it exists
      const encData = util.encrypt(this.tmpSharedSecret, JSON.stringify(data), DEFAULT_COUNTER);
      // Second, build the body and encrypt it
      const body = {
        type: route,
        data: encData,

      }
      const encReq = util.encrypt(this.headerSecret, req, DEFAULT_COUNTER);
      // Now make the request
      console.log('encreq', encReq)
      request.post(`${this.url}/${route}`).send({ req: encReq})
      .then((res) => {
        const ecdhPub = this.ecdhKey.getPublic().encode('hex');      
        console.log(ecdhPub)
        if (!res.body) return reject(`Did not get a response body from /${route}`)
        else if (res.status !== 200) return reject(`Error from /${route}: ${res.status}`)
        else if (res.body.key != ecdhPub) return reject(`Returned wrong ECDH key: ${res.body.key}`)
        return resolve(req.body);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }


}

exports.default = GridPlusSDK;
