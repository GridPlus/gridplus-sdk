export interface DecodedCalldata {
  name: string;
  params: Array<{ name: string; type: string }>;
  values: any[];
}

export const decodeCalldata = (data: Buffer): DecodedCalldata | null => {
  try {
    // First 4 bytes are the function selector
    const selector = data.slice(0, 4).toString('hex');
    
    // Known function signatures
    const signatures = {
      'ac9650d8': { name: 'multicall', params: [{ name: 'data', type: 'bytes[]' }] },
      '0c49ccbe': { name: 'decreaseLiquidity', params: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'liquidity', type: 'uint128' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]},
      'fc6f7865': { name: 'collect', params: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'amount0Max', type: 'uint128' },
        { name: 'amount1Max', type: 'uint128' }
      ]}
    };

    const sig = signatures[selector];
    if (!sig) return null;

    // Decode the parameters based on their types
    const values = [];
    let offset = 4; // Skip function selector

    for (const param of sig.params) {
      if (param.type === 'bytes[]') {
        // For bytes[], first get the offset to the array data
        const arrayOffset = parseInt(data.slice(offset, offset + 32).toString('hex'), 16);
        offset += 32;
        
        // Get the array length
        const arrayStart = arrayOffset + 32; // Skip the offset itself
        const arrayLength = parseInt(data.slice(arrayStart - 32, arrayStart).toString('hex'), 16);
        
        // Get each bytes element
        const bytesArray = [];
        let bytesOffset = arrayStart;
        for (let i = 0; i < arrayLength; i++) {
          const elementOffset = parseInt(data.slice(bytesOffset, bytesOffset + 32).toString('hex'), 16);
          const elementStart = arrayOffset + elementOffset;
          const elementLength = parseInt(data.slice(elementStart, elementStart + 32).toString('hex'), 16);
          const element = data.slice(elementStart + 32, elementStart + 32 + elementLength);
          bytesArray.push(element);
          bytesOffset += 32;
        }
        values.push(bytesArray);
      } else if (param.type === 'uint256' || param.type === 'uint128') {
        const value = data.slice(offset, offset + 32);
        values.push(BigInt('0x' + value.toString('hex')));
        offset += 32;
      } else if (param.type === 'address') {
        const value = '0x' + data.slice(offset + 12, offset + 32).toString('hex');
        values.push(value);
        offset += 32;
      }
    }

    return {
      name: sig.name,
      params: sig.params,
      values
    };
  } catch {
    return null;
  }
}; 