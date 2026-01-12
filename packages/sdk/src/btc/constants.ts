export const SLIP132_VERSION_BYTES = {
  // Mainnet
  xpub: { public: 0x0488b21e, private: 0x0488ade4 }, // BIP44 - Legacy (P2PKH)
  ypub: { public: 0x049d7cb2, private: 0x049d7878 }, // BIP49 - Wrapped SegWit (P2SH-P2WPKH)
  zpub: { public: 0x04b24746, private: 0x04b2430c }, // BIP84 - Native SegWit (P2WPKH)

  // Testnet
  tpub: { public: 0x043587cf, private: 0x04358394 }, // BIP44 - Legacy (P2PKH)
  upub: { public: 0x044a5262, private: 0x044a4e28 }, // BIP49 - Wrapped SegWit (P2SH-P2WPKH)
  vpub: { public: 0x045f1cf6, private: 0x045f18bc }, // BIP84 - Native SegWit (P2WPKH)
} as const;

export const BTC_PURPOSES = {
  LEGACY: 44, // BIP44 - P2PKH
  WRAPPED: 49, // BIP49 - P2SH-P2WPKH
  NATIVE: 84, // BIP84 - P2WPKH
} as const;

export const BTC_COIN_TYPES = {
  MAINNET: 0,
  TESTNET: 1,
} as const;

export const BTC_NETWORKS = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet',
  REGTEST: 'regtest',
} as const;
