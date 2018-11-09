const codes = require('./codes.json');
const config = require('../config.js');

// Build a request to create a permission
exports.buildPermissionRequest = function(opts) {
  if (opts.schemaCode === undefined || opts.params === undefined || opts.timeLimit === undefined) return 'You must include "schemaCode", "params", and "timeLimit" params in this request.';
  if (typeof opts.timeLimit !== 'number' || opts.timeLimit < 0) return '"timeLimit" must be a non-negative integer';
  if (typeof opts.schemaCode !== 'string') return '"schemaCode" must be a string';
  if (!codes.code[opts.schemaCode]) return '"schemaCode" provided is unsupported. Please see documentation for allowed schema codes.';
  const code = codes.code[opts.schemaCode];
  const req = {
    schemaIndex: code.schema,
    typeIndex: code.type,
    rules: [],
    timeLimit: opts.timeLimit,
  };
  const expectedTypes = codes.schemaTypes[req.schemaIndex];
  const expectedNames = codes.schemaNames[req.schemaIndex];
  expectedNames.forEach((paramName, i) => {
    if (opts.params[paramName] !== undefined) {
      // if (typeof opts.params[paramName] !== expectedTypes[i]) return `Incorrect param type (${paramName}): Expected ${expectedTypes[i]}, got ${typeof opts.params[paramName]}`;
      const rule = getRule(opts.params[paramName]);
      if (rule === null) return 'Could not parse params into rule set. Please see documentation for correct formatting.';
      req.rules = req.rules.concat(rule);
    } else {
      req.rules = req.rules.concat([null, null, null]);
    }
  })
  return req;
}

// Build a signature request against a permission
exports.buildSigRequest = function(opts) {
  if (opts.schemaCode === undefined || opts.params === undefined) return 'You must include "schemaCode" and "params" in this request.';
  const code = codes.code[opts.schemaCode];
  let req = {
    schemaIndex: code.schema,
    typeIndex: code.type,
    params: []
  };
  let err = null;
  codes.schemaNames[req.schemaIndex].forEach((paramName) => {
    if (opts.params[paramName] === undefined) err = `You are missing parameter ${paramName}`;
    req.params.push(opts.params[paramName]);
  });
  // Some schema types will add additional stuff (e.g. BTC utxo inputs)
  req = addExtraParams(opts, req);
  if (err) return err;
  else     return req;
}

// Parse the human-readable params object into an instruction set for the Lattice
function getRule(x) {
  const range = {
    bounds: [null, null],
    inclusive: [null, null], // if true, it means it can be equal
  };
  let toReturn = null;
  Object.keys(x).forEach((k) => {
    switch(k) {
      case 'eq':
        toReturn = ['equals', x[k], null];
        break;
      case 'gt': 
        range.bounds[0] = x[k];
        range.inclusive[0] = false;
        break;
      case 'gte':
        range.bounds[0] = x[k];
        range.inclusive[0] = true;
        break;
      case 'lt':
        range.bounds[1] = x[k];
        range.inclusive[1] = false;
        break;
      case 'lte':
        range.bounds[1] = x[k];
        range.inclusive[1] = true;
    }
  });

  // Assuming we have a range (i.e. this is not an "equals" param), we need to
  // go through a series of options
  if (toReturn !== null) {
    return toReturn;
  } else if (range.bounds[0] === null && range.inclusive[1] === false) {
    return ['lt', range.bounds[1], null];
  } else if (range.bounds[0] === null && range.inclusive[1] === true) {
    return ['lte', range.bounds[1], null];
  } else if (range.bounds[1] === null && range.inclusive[0] === false) {
    return ['gt', range.bounds[0], null];
  } else if (range.bounds[1] === null && range.inclusive[0] === true) {
    return ['gte', range.bounds[0], null];
  } else if (range.bounds[0] !== null && range.bounds[1] !== null) {
    // NOTE: right now, "between" is inclusive on both sides of the range
    return ['between', range.bounds[0], range.bounds[1]];
  } else {
    return null;
  }
}

function addExtraParams(opts, req) {
  switch(opts.schemaCode) {
    case 'BTC':
      if (opts.inputs && Array.isArray(opts.inputs)) {
        opts.inputs.forEach((i) => {
          const parsedInput = [ i.hash, i.outIndex, i.scriptType, i.spendAccountIndex, i.inputValue ];
          req.params = req.params.concat(parsedInput);
        });
      }
      break;
    case 'ETH-ERC20':
      req.params[req.params.length - 1] = config.erc20.transfer(opts.params.data.to, opts.params.data.value);
      break;
  }
  // Extras
  if (opts.sender)       req.sender = opts.sender;
  if (opts.accountIndex) req.accountIndex = opts.accountIndex;
  if (opts.network)      req.network = opts.network;
  return req;
}