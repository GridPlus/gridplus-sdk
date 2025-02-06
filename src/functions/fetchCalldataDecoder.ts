import { encodeFunctionData } from 'viem';
import { encodeABIParameters } from '../utils/abi';
import { fetch4ByteData } from '../utils/4byte';
import { fetchABIFromChain } from '../utils/chain';
import { parseSignature } from '../utils/signature';

const getSelector = (data: string | Buffer): string => {
  if (Buffer.isBuffer(data)) {
    return data.slice(0, 4).toString('hex');
  }
  return data.slice(2, 10);
};

const fetchCalldataDecoder = async (
  data: string | Buffer,
  to: string,
  chainId: string | number = 1,
  _skipNested = false,
): Promise<{ abi: any; def: any }> => {
  const selector = getSelector(data);
  
  try {
    // Try to get ABI from chain first
    const chainData = await fetchABIFromChain(to, chainId);
    if (chainData) {
      // Keep the full contract ABI
      const matchingFunction = chainData.find((item: any) => {
        if (item.type !== 'function') return false;
        try {
          const encoded = encodeFunctionData({
            abi: [item],
            functionName: item.name,
            args: item.inputs.map(() => '0x'),
          });
          return encoded.slice(2, 10) === selector;
        } catch {
          return false;
        }
      });

      if (matchingFunction) {
        const def = encodeABIParameters(
          matchingFunction.inputs.map((input: any, i: number) => ({
            name: `${i + 1}`,
            type: input.type,
          })),
        );
        return { abi: chainData, def };
      }
    }

    // Fallback to 4byte directory
    const fourByteData = await fetch4ByteData(selector);
    if (fourByteData && fourByteData.length > 0) {
      const parsedSignature = parseSignature(fourByteData[0].text_signature);
      
      if (parsedSignature) {
        const def = encodeABIParameters(
          parsedSignature.inputs.map((input: any, i: number) => ({
            name: `${i + 1}`,
            type: input.type,
          })),
        );
        return { abi: fourByteData, def };
      }
    }

  } catch (err) {
    console.warn('Error in fetchCalldataDecoder:', err);
  }

  return { abi: null, def: null };
};

export { fetchCalldataDecoder }; 