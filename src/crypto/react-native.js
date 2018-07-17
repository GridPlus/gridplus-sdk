const sjcl = require('sjcl');
let entropy, createHash, generateEntropy, randomBytes;

function init(_entropy) {
  // Hash whatever the entropy provided is and use that hash as the entropy for sjcl
  const hash = sjcl.hash.sha256.hash(_entropy);
  entropy = sjcl.codec.hex.fromBits(hash);
  // Set sjcl.random with the entropy. It should be sufficient for our purposes
  sjcl.random.addEntropy(entropy);

  // Define the functions to export
  generateEntropy = function() {
    return sjcl.codec.hex.fromBits(sjcl.random.randomWords(8));
  }

  randomBytes = function(n) {
    const words = Math.ceil(n / 4);
    const bytes = sjcl.codec.hex.fromBits(sjcl.random.randomWords(words));
    return bytes.slice(0, n * 2);
  }

  createHash = function(x) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(x));
  }
}


function fetch() {
  return {
    createHash,
    generateEntropy,
    randomBytes,
  }
}

export default {
  init,
  fetch,
}
