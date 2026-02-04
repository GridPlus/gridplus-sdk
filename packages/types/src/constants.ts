/**
 * SDK Constants that are needed for type definitions
 */

export const CURRENCIES = {
  ETH: 'ETH',
  BTC: 'BTC',
  ETH_MSG: 'ETH_MSG',
} as const;

export type Currency = keyof typeof CURRENCIES;
