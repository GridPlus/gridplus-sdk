import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const getChainConfig = (chainId: string | number) => {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  switch (id) {
    case 1:
      return {
        chain: mainnet,
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: process.env.ETHERSCAN_API_KEY,
      };
    default:
      return null;
  }
};

export const fetchABIFromChain = async (
  address: string,
  chainId: string | number,
): Promise<any[]> => {
  try {
    const config = getChainConfig(chainId);
    if (!config) return null;

    const { apiUrl, apiKey } = config;
    const url = `${apiUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      return JSON.parse(data.result);
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching ABI from chain:', error);
    return null;
  }
}; 