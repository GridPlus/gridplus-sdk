import crypto from 'crypto';

const NodeCrypto = {
  createHash: (input) => { return crypto.createHash('sha256').update(input).digest(); },
  generateEntropy: () => { return crypto.randomBytes(32); },
  randomBytes: (num) => { return crypto.randomBytes(num).toString('hex'); },
}


export default NodeCrypto;
