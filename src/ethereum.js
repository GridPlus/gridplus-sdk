// Utils for Ethereum transactions. This is effecitvely a shim of ethereumjs-util, which
// does not have browser (or, by proxy, React-Native) support.
const secp256k1 = require('secp256k1');
const keccak256 = require('js-sha3').keccak256;
const Buffer = require('buffer/').Buffer

// Attach a recovery parameter to a signature by brute-forcing ECRecover
exports.addRecoveryParam = function(payload, sig, address, chainId=1, preventReplays=true) {
  try {
    // Rebuild the keccak256 hash here so we can `ecrecover`
    const hash = Buffer.from(keccak256(payload), 'hex');
    sig.v = 27;
    // Fix signature componenet lengths to 32 bytes each
    const r = fixLen(sig.r, 32); sig.r = r;
    const s = fixLen(sig.s, 32); sig.s = s;
    // Calculate the recovery param
    const rs = Buffer.concat([r, s]);
    let pubkey = secp256k1.recover(hash, rs, sig.v - 27, false).slice(1);
    // If the first `v` value is a match, return the sig!
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      if (preventReplays === true) sig.v  = updateRecoveryParam(sig.v, chainId);
      return sig;
    }
    // Otherwise, try the other `v` value
    sig.v = 28;
    pubkey = secp256k1.recover(hash, rs, sig.v - 27, false).slice(1);
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      if (preventReplays === true) sig.v  = updateRecoveryParam(sig.v, chainId);
      return sig;
    } else {
      // If neither is a match, we should return an error
      throw new Error('Invalid Ethereum signature returned.');
    }
  } catch (err) {
    throw new Error(err);
  }
}

// Returns address string given public key buffer
function pubToAddrStr(pub) {
  return keccak256(pub).slice(-40);
}

function fixLen(msg, length) {
  const buf = Buffer.alloc(length)
  if (msg.length < length) {
    msg.copy(buf, length - msg.length)
    return buf
  }
  return msg.slice(-length)
}

function updateRecoveryParam(v, chainId) {
  return v + (chainId * 2) + 8;
}


exports.chainIds = {
  mainnet: 1,
  roptsten: 3,
  rinkeby: 4,
  kovan: 42,
  goerli: 6284
}