const sjcl = require('sjcl');

class ReactNativeCrypto {
  constructor(e) {
    // Hash whatever the entropy provided is and use that hash as the entropy for sjcl
    const hash = sjcl.hash.sha256.hash(e);
    const entropy = sjcl.codec.hex.fromBits(hash);
    // Set sjcl.random with the entropy. It should be sufficient for our purposes
    sjcl.random.addEntropy(entropy);

    // Define the functions to export
    this.generateEntropy = function() {
      return sjcl.codec.hex.fromBits(sjcl.random.randomWords(8));
    }

    this.randomBytes = function(n) {
      const words = Math.ceil(n / 4);
      const bytes = sjcl.codec.hex.fromBits(sjcl.random.randomWords(words));
      return bytes.slice(0, n * 2);
    }

    this.createHash = function(x) {
      return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(x));
    }
  }

  functions() {
    return {
      createHash: this.createHash,
      generateEntropy: this.generateEntropy,
      randomBytes: this.randomBytes,
    }
  }
}

export default ReactNativeCrypto;
