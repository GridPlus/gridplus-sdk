import { RLP } from '@ethereumjs/rlp';

export const encodeDef = (
  name: string,
  params: Array<{ name: string; type: string }>,
  _values: any[],
): Buffer => {
  // Encode the parameters in RLP format
  const encodedParams = params.map((param, index) => {
    const paramType = param.type;
    const typeBuffer = Buffer.from(`#${index + 1}${paramType}`);
    const typeEncoding = Buffer.from([0]); // Add a trailing zero byte
    return Buffer.concat([typeBuffer, typeEncoding]);
  });

  // Encode the function name and parameters
  const nameBuffer = Buffer.from(name);
  const result = Buffer.concat([nameBuffer, ...encodedParams]);
  return Buffer.from(RLP.encode(result));
};