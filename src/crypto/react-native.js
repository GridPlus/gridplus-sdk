const sjcl = require('sjcl');

class ReactNativeCrypto {

  constructor(e) {
    // Hash whatever the entropy provided is and use that hash as the entropy for sjcl
    const hash = sjcl.hash.sha256.hash(e);
    const entropy = sjcl.codec.hex.fromBits(hash);
    this.entropy = entropy;
    // Set sjcl.random with the entropy. It should be sufficient for our purposes
    sjcl.random.addEntropy(entropy);
  }

  generateEntropy () {
    return sjcl.codec.hex.fromBits(sjcl.random.randomWords(8));
  }

  randomBytes (n) {
    const words = Math.ceil(n / 4);
    const bytes = sjcl.codec.hex.fromBits(sjcl.random.randomWords(words));
    return bytes.slice(0, n * 2);
  }

  createHash (x) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(x));
  }

}

export default ReactNativeCrypto;
