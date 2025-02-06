interface ParsedSignature {
  name: string;
  inputs: { type: string }[];
}

export const parseSignature = (signature: string): ParsedSignature | null => {
  try {
    const match = signature.match(/^([^(]+)\((.*)\)$/);
    if (!match) return null;

    const [, name, params] = match;
    const inputs = params
      .split(',')
      .filter(Boolean)
      .map((param) => ({ type: param.trim() }));

    return { name, inputs };
  } catch (error) {
    console.error('Error parsing signature:', error);
    return null;
  }
}; 