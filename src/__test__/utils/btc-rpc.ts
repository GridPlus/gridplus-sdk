import fetch from 'node-fetch';

interface RpcResponse {
  result: any;
  error: any;
  id: string;
}

export class BtcRpc {
  private url: string;
  private auth: string;

  constructor(
    host: string = '127.0.0.1',
    port: number = 18443,
    username: string = 'user',
    password: string = 'pass'
  ) {
    this.url = `http://${host}:${port}`;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  async call(method: string, params: any[] = []): Promise<any> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${this.auth}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method,
        params
      })
    });

    const data = await response.json() as RpcResponse;
    if (data.error) {
      throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
    }

    return data.result;
  }

  // Specific RPC methods we need
  async importAddress(address: string, label: string = '', rescan: boolean = true): Promise<void> {
    console.log(`[BtcRpc] Importing address ${address} (rescan: ${rescan})`);
    await this.call('importaddress', [address, label, rescan]);
  }

  async listUnspent(minConf: number = 0, maxConf: number = 9999999, addresses: string[] = []): Promise<any[]> {
    console.log(`[BtcRpc] Listing unspent for addresses:`, addresses);
    
    // Use scantxoutset to find UTXOs for any address
    const descriptor = addresses.map(addr => `addr(${addr})`);
    const result = await this.call('scantxoutset', ['start', descriptor]);
    
    if (!result.success) {
      throw new Error('Failed to scan UTXO set');
    }

    // Convert to format similar to listunspent
    return result.unspents.map((utxo: any) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      address: addresses[0], // Since we're scanning for one address at a time
      amount: utxo.amount,
      value: Math.floor(utxo.amount * 100000000),  // Convert BTC to satoshis
      height: utxo.height,
      confirmations: result.bestblock ? result.bestblock - utxo.height : 0
    }));
  }

  async getRawTransaction(txid: string, verbose: boolean = true): Promise<any> {
    console.log(`[BtcRpc] Getting raw transaction ${txid}`);
    return this.call('getrawtransaction', [txid, verbose]);
  }

  async decodeRawTransaction(hexstring: string): Promise<any> {
    return this.call('decoderawtransaction', [hexstring]);
  }

  async sendRawTransaction(hexstring: string): Promise<string> {
    console.log(`[BtcRpc] Broadcasting raw transaction`);
    return this.call('sendrawtransaction', [hexstring]);
  }

  async generateToAddress(nblocks: number, address: string): Promise<string[]> {
    console.log(`[BtcRpc] Generating ${nblocks} blocks to ${address}`);
    return this.call('generatetoaddress', [nblocks, address]);
  }

  async getTransaction(txid: string): Promise<any> {
    console.log(`[BtcRpc] Getting transaction ${txid}`);
    return this.getRawTransaction(txid, true);
  }
} 