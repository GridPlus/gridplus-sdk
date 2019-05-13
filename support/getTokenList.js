const BASE_DIR = `${__dirname}/tokens`;
const mainTokens = require(`${BASE_DIR}/main.json`);
const rinkebyTokens = require(`${BASE_DIR}/rinkeby.json`);
const tokens = [ ['main', mainTokens ], ['rinkeby', rinkebyTokens ] ];
const fs = require('fs');
const tokensBySymbol = {}, tokensByAddress = {};
let count = 0;
/*try {
  tokens.forEach((tokenMetaData) => {
    const tokenType = tokenMetaData[0];
    const tokenList = tokenMetaData[1];
    tokensBySymbol[tokenType] = {};
    tokensByAddress[tokenType] = {};
    tokenList.forEach((t) => {
      if (t.symbol !== 'ETH') {
        tokensBySymbol[tokenType][t.symbol] = {
          name: t.name || '',
          address: t.contract_address,
          decimals: t.decimals || 0,
        };
        tokensByAddress[tokenType][t.contract_address] = {
          symbol: t.symbol,
          name: t.name || '',
          decimals: t.decimals || 0,
        }
        count += 1;
      }
    })
    
    fs.writeFile(`${BASE_DIR}/../../tokensByAddress.json`, JSON.stringify(tokensByAddress), 'utf8', (err) => {
      if (err) throw new Error(`Error writing new JSON file (tokensByAddress.json): ${err}`)
      else {
        fs.writeFile(`${BASE_DIR}/../../tokensBySymbol.json`, JSON.stringify(tokensBySymbol), 'utf8', (err) => {
          if (err) throw new Error(`Error writing new JSON file (tokensBySymbol.json): ${err}`)
          else     console.log(`Successfully parsed ${count} tokens`);
        })
      }
    })
    
  })
} catch (err) {
  throw new Error(`Error parsing token list on item ${count}: ${err}`);
}
*/
