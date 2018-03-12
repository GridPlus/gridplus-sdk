// Mappings to indices in the k81.
//-----------------------------
// CORRESPONDS TO FIRMWARE V0.0
//-----------------------------

exports.schemas = {
  'ethTx': {
    index: 0,
    fields: ['nonce', 'gasPrice', 'gasLimit', 'to', 'value', 'data']
  },
}

// Types indicate which values should be restricted. There are three values
// for each rule: ruleType, param1, param2. They are ordered based on the
// respective schema
exports.types = {
  'standardETH': {
    index: 0,
    schema: 'ethTx',
    rules: [
      null, null, null,
      null, null, null,
      null, null, null,
      null, null, null,
      null, null, null,
      'equals', '0x', null,
    ]
  },
  'standardBTC': 1,
}

exports.ruleTypes = [ 'equals', 'less', 'greater' ];

exports.longestSchema = 6;

exports.formatArr = function(a) {
  return a.join(',');
}
