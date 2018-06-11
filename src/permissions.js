// Add, update, delete permissions given a pairing
// Permissions are sets of rules mapping a pairing to a wallet and a remote
// signing scheme.
/*const enums = require('./enums.js');
const internalCrypto = require('./internalCrypto.js');

// Parse the rules
exports.parseRules = function(rules, schema, type, cb) {
  const fields = enums.schemas[schema].fields;
  const typeRules = enums.types[type].rules;
  const L = enums.longestSchema;
  let parsedRules = [];
  let err;
  fields.forEach((field, i) => {
    const typeRule = typeRules[i];
    let rule;
    if (typeRule[0] == null) {
      // If there is no type rule, pass the provided rule
      rule = rules[field];
    } else {
      // If there *is* a type rule, overwrite the one provided
      rule = typeRule;
    }
    // Write the rule
    parsedRules.push(rule[0]);
    parsedRules.push(rule[1]);
    if (rule.length > 2) { parsedRules.push(rule[2]); }
    else { parsedRules.push('0x'); }
  })
  for (let i = fields.length * 3; i < L * 3; i++) {
    parsedRules.push('0x');
  }
  return parsedRules;
}


// Functions to check for errors in the input
exports.getTimeLimitErr = function(timeLimit) {
  let err = null;
  if (typeof timeLimit != 'number') {
    err = 'Time limit must be a number'
  } else if (timeLimit < 60) {
    err = 'Time limit must be >60'
  }
  return err;
}

exports.getSchemaErr = function(schema, type) {
  let err = null;
  if (enums.shcemas[schema] === undefined) {
    err = 'Unsupported schema'
  } else if (enums.types[type] === undefined) {
    err = 'Unsupported type'
  }
  return err;
}

exports.getRulesErr = function(rules) {
  let err = null;
  Object.keys(rules).forEach((r) => {
    if (typeof rules[r] != 'object' || rules[r].length === undefined) {
      err = 'Rules must be an array';
    } else if (enums.ruleTypes.indexOf(rules[r][0]) === -1) {
      err = 'Unsupported rule type';
    } else if (rules[r].length > 3 || rules[r].length < 2) {
      err = 'Rules must include type and one or two parameter values';
    }
  });
  return err;
}
*/