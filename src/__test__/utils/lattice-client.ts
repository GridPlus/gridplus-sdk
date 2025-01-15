interface SignData {
  prevOuts: {
    txHash: string;
    value: number;
    index: number;
    signerPath: number[];
  }[];
  recipient: string;
  value: number;
  fee: number;
  changePath: number[];
}

// Mock setup for testing
export async function setupClient() {
  console.log('[LatticeClient] Setting up test client');
  return {
    name: 'Test Lattice Client'
  };
}

// Mock legacy address generation
export async function fetchBtcLegacyAddresses(client: any): Promise<string[]> {
  console.log('[LatticeClient] Fetching legacy addresses');
  // Return a test address for regtest
  return ['mwCwTceJvYV27KXBc3NJZys6CjsgsoeHmf'];
}

// Mock signing function
export async function signBtcLegacyTx(data: SignData): Promise<{ tx: string }> {
  console.log('[LatticeClient] Signing legacy transaction', data);
  // Return a mock signed transaction
  return {
    tx: '02000000000101f86037d49b3a3453d60d6d884f1f62f3fa534c7ae8d3c2fba0e6f0dd6ac0e6e40000000000ffffffff01204e00000000000016001434e6c3625c65c94a267e4e15bbd2e7cfc2540d1102483045022100b8a9566c2f183c68bfff980070be8d5892afb8ae915c8a1c2e9fb156c76f357d022037c914d3a4c5d77849db41f8e506ad5d56d52453d47a6f7446fac128a4d368ce012102c97dc3f4420402e01a113984311bf4a1b8de376653f3147f91544c7b8e2bc74a00000000'
  };
} 