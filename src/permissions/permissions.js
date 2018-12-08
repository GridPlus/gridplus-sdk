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
  // const expectedTypes = codes.schemaTypes[req.schemaIndex];
  const expectedNames = codes.schemaNames[req.schemaIndex][req.typeIndex];
  expectedNames.forEach((name, i) => {
    const paramName = expectedNames[i][0];
    if (opts.params[paramName] !== undefined) {
      const rule = getRule(name, opts.params[paramName]);
      if (rule === null) return 'Could not parse params into rule set. Please see documentation for correct formatting.';
      req.rules = req.rules.concat(rule);
    } else {
      req.rules = req.rules.concat([null, null, null]);
    }
  })
  req.rules = _postProcessRules(req.rules, code.schema, code.type)
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
  codes.schemaNames[req.schemaIndex][req.typeIndex].forEach((x) => {
    const paramName = x[0];
    if (opts.params[paramName] === undefined) err = `You are missing parameter ${paramName}`;
    req.params.push(opts.params[paramName]);
  });
  // Some schema types will add additional stuff (e.g. BTC utxo inputs)
  req = addExtraParams(opts, req);
  if (err) return err;
  else     return req;
}

exports.parsePermissions = function(permissions) {
  const parsedPermissions = [];
  permissions.forEach((p) => {
    const parsedP = {
      schemaCode: codes.invCode[p.schemaIndex][p.typeIndex],
      timeLimit: p.timeLimit,
      params: {}
    };
    let nextI = 0;
    p.rules.forEach((ruleType, i) => {
      if (i % 3 === 0 && nextI <= i) {
        const ruleIndex = i / 3;
        const rule = codes.schemaNames[p.schemaIndex][p.typeIndex][ruleIndex];
        const ruleName = rule[0];
        const nestedRules = rule[1];
        if (ruleType === null) {
          null;
        } else if (nestedRules === null) {
          parsedP.params[ruleName] = {
            [ruleType]: _parseRule(ruleType, p, i)
          };
        } else {
          const nested = {};
          switch(parsedP.schemaCode) {
            case 'ETH-ERC20':
              // Skip the function definition
              if (p.rules[i+3] !== null) { // to
                nested[nestedRules[0]] = {
                  [p.rules[i+3]]: _parseRule(p.rules[i+3], p, i+3)
                };
              }
              if (p.rules[i+6] !== null) {
                nested[nestedRules[1]] = { // value
                  [p.rules[i+6]]: _parseRule(p.rules[i+6], p, i+6)
                };
              }
              parsedP.params[ruleName] = nested;
              nextI = i+9;
              break;
            default:
              parsedP.params[ruleName] = {};
              break;
          }
        }
      }
    });
    parsedPermissions.push(parsedP);
  })
  return parsedPermissions;
}

function _parseRule(ruleType, p, i) {
  switch (ruleType) {
    case null:
      return;
    case 'between':
      return [ p.rules[i + 1], p.rules[i + 2] ];
    default:
      return p.rules[i + 1];
  }
}


// Parse the human-readable params object into an instruction set for the Lattice
function getRule(name, param) {
  const names = [];
  const ranges = [];
  if (name[1] !== null) {
    name[1].forEach((subName) => {
      names.push(subName)
      ranges.push({
        bounds: [null, null],
        inclusive: [null, null], // if true, it means it can be equal
      })
    })
  } else {
    names.push(name[0]);
    ranges.push({
      bounds: [null, null],
      inclusive: [null, null],
    })
  }
  const toReturn = [];
  names.forEach((name, i) => {
    const p = names.length === 1 ? param : param[name];
    if (!p) {
      ranges[i].bounds = [null, null];
      ranges[i].inclusive = [false, false];
      toReturn.push(null);
    } else {
      Object.keys(p).forEach((k) => {
        switch (k) {
          case 'eq':
            toReturn.push([k, p[k], null]);
            break;
          case 'gt': 
            ranges[i].bounds[0] = p[k];
            ranges[i].inclusive[0] = false;
            toReturn.push(null);
            break;
          case 'gte':
            ranges[i].bounds[0] = p[k];
            ranges[i].inclusive[0] = true;
            toReturn.push(null);
            break;
          case 'lt':
            ranges[i].bounds[1] = p[k];
            ranges[i].inclusive[1] = false;
            toReturn.push(null);
            break;
          case 'lte':
            ranges[i].bounds[1] = p[k];
            ranges[i].inclusive[1] = true;
            toReturn.push(null);
            break;
        }
      })
    }
  });
  let rules = [];
  ranges.forEach((range, i) => {
    // Assuming we have a range (i.e. this is not an "equals" param), we need to
    // go through a series of options
    if (toReturn[i] !== null) {
      rules = rules.concat(toReturn[i]);
    } else if (range.bounds[0] === null && range.bounds[1] === null) {
      rules = rules.concat([null, null, null]);
    } else if (range.bounds[0] === null && range.inclusive[1] === false) {
      rules = rules.concat(['lt', range.bounds[1], null]);
    } else if (range.bounds[0] === null && range.inclusive[1] === true) {
      rules = rules.concat(['lte', range.bounds[1], null]);
    } else if (range.bounds[1] === null && range.inclusive[0] === false) {
      rules = rules.concat(['gt', range.bounds[0], null]);
    } else if (range.bounds[1] === null && range.inclusive[0] === true) {
      rules = rules.concat(['gte', range.bounds[0], null]);
    } else if (range.bounds[0] !== null && range.bounds[1] !== null) {
      // NOTE: right now, "between" is inclusive on both sides of the range
      rules = rules.concat(['between', range.bounds[0], range.bounds[1]]);
    } else {
      rules = rules.concat([null, null, null]);
    }
  })
  return rules;
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
      req.params = req.params.slice(0, -1);
      req.params.push('0xa9059cbb');
      req.params.push(opts.params.data.to)
      req.params.push(opts.params.data.value);
      // req.params[req.params.length - 1] = config.erc20.transfer(opts.params.data.to, opts.params.data.value);
      
      break;
  }
  // Extras
  if (opts.sender)       req.sender = opts.sender;
  if (opts.accountIndex) req.accountIndex = opts.accountIndex;
  if (opts.network)      req.network = opts.network;
  return req;
}

function _postProcessRules(rules, schemaIdx, typeIdx) {
  try {
    const schemaName = codes.invCode[schemaIdx][typeIdx];
    if (schemaName === 'ETH-ERC20') {
      // Need to splice in function call
      rules.splice(rules.length - 6, 0, 'eq')
      rules.splice(rules.length - 6, 0, '0xa9059cbb')
      rules.splice(rules.length - 6, 0, null)
    }
  } catch (e) {
    null;
  }
  return rules;
}