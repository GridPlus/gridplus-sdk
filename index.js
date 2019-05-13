const Bitcoin = require('./src/providers/Bitcoin');
const debug = require('debug');
const Ethereum = require('./src/providers/Ethereum');
const Client = require('./src/client');

// Client.prototype.tokensBySymbol = require('./lib/tokensBySymbol.json');
// Client.prototype.tokens = Client.prototype.tokensBySymbol;
// Client.prototype.tokensByAddress = require('./lib/tokensByAddress.json');


module.exports = {
  Client,
  Providers: {
    Bitcoin,
    Ethereum,
  }
};
