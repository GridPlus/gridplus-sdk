import { RLP } from '@ethereumjs/rlp';

export const encodeABIParameters = (
  inputs: { name: string; type: string }[],
): Buffer => {
  if (!inputs?.length) return null;

  return Buffer.from(
    RLP.encode([
      ...inputs.map((input) => 
        Buffer.concat([
          Buffer.from(input.name),
          Buffer.from(input.type),
          Buffer.from([0]),
        ]),
      ),
    ]),
  );
}; 