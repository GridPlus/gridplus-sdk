export const serializeObjectWithBuffers = (obj: any) => {
  return Object.entries(obj).reduce((acc: any, [key, value]) => {
    if (value instanceof Buffer) {
      acc[key] = { isBuffer: true, value: value.toString('hex') };
    } else if (typeof value === 'object') {
      acc[key] = serializeObjectWithBuffers(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const deserializeObjectWithBuffers = (obj: any) => {
  return Object.entries(obj).reduce((acc: any, [key, value]: any) => {
    if (value?.isBuffer) {
      acc[key] = Buffer.from(value.value, 'hex');
    } else if (typeof value === 'object') {
      acc[key] = deserializeObjectWithBuffers(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};
