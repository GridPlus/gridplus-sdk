const f = require('./tokens/raw.json');
const fs = require('fs');
const tokensBySymbol = {}, tokensByAddress = {};
let count = 0;
try {

  f.forEach((t) => {
    if (t.symbol !== 'ETH') {
      tokensBySymbol[t.symbol] = {
        name: t.name || '',
        address: t.contract_address,
        decimals: t.decimals || 0,
      };
      tokensByAddress[t.contract_address] = {
        symbol: t.symbol,
        name: t.name || '',
        decimals: t.decimals || 0,
      }
      count += 1;
    }
  })
  
  fs.writeFile('./tokens/tokensByAddress.json', JSON.stringify(tokensByAddress), 'utf8', (err) => {
    if (err) throw new Error(`Error writing new JSON file (tokensByAddress.json): ${err}`)
    else {
      fs.writeFile('./tokens/tokensBySymbol.json', JSON.stringify(tokensBySymbol), 'utf8', (err) => {
        if (err) throw new Error(`Error writing new JSON file (tokensBySymbol.json): ${err}`)
        else     console.log(`Successfully parsed ${count} tokens`);
      })
    }
  })
  
} catch (err) {
  throw new Error(`Error parsing token list on item ${count}: ${err}`);
}
