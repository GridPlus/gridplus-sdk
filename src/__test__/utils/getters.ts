import seedrandom from 'seedrandom';

export const getEnv = () => {
  if (!process.env) throw new Error('env cannot be found');
  return process.env
}
export const getDeviceId = (): string => getEnv()['DEVICE_ID'] ?? '';
export const getN = (): number => parseInt(getEnv()['N'] ?? '20');
export const getSeed = (): string => getEnv()['SEED'] ?? 'myrandomseed';
export const getTestnet = (): string => getEnv()['TESTNET'] ?? '';
export const getEtherscanKey = (): string => getEnv()['ETHERSCAN_KEY'] ?? '';

export const getPrng = (seed?: string) => {
  // @ts-expect-error -- @types/seedrandom is inaccurate
  return new seedrandom(seed ? seed : getSeed());
};