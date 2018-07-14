import crypto from 'crypto';

export default {
  createHash: (input) => { return crypto.createHash('sha256').update(input).digest(); },
  generateEntropy: () => { return crypto.randomBytes(32); },
  randomBytes: (num) => { return crypto.randomBytes(num).toString('hex'); },
}