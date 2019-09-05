// Utils for Ethereum transactions
const EthereumUtil = require('ethereumjs-util');

// Attach a recovery parameter to a signature by brute-forcing ECRecover
exports.addRecoveryParam = function(payload, sig, address) {
  // Rebuild the keccak256 hash here so we can `ecrecover`
  const hash = EthereumUtil.keccak(`0x${payload.toString('hex')}`);
  sig.v = 27;
  // Convert `r` and `s` from our UInt8 arrays to regular Buffers
  const r = Buffer.from(sig.r.toString('hex'), 'hex');
  const s = Buffer.from(sig.s.toString('hex'), 'hex');
  let pubkey = EthereumUtil.ecrecover(hash, sig.v, r, s);
  // If the first `v` value is a match, return the sig!
  if (EthereumUtil.pubToAddress(pubkey).toString('hex') == address.toString('hex')) {
    return sig;
  }
  // Otherwise, try the other `v` value
  sig.v = 28;
  pubkey = EthereumUtil.ecrecover(hash, sig.v, r, s);
  if (EthereumUtil.pubToAddress(pubkey).toString('hex') == address.toString('hex')) {
    return sig;
  } else {
    // If neither is a match, we should return an error
    return { err: 'Invalid Ethereum signature returned.' };
  }
}
