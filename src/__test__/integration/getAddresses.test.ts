import { BIP_CONSTANTS, HARDENED_OFFSET } from '../../constants';
import { getDeviceId } from '../utils/getters';
import { setupTestClient } from '../utils/helpers';

const { PURPOSES, COINS } = BIP_CONSTANTS;
describe('getAddresses', async () => {
  const client = setupTestClient();
  await client.connect(getDeviceId());

  describe.skip('Bitcoin', async () => {
    describe('Bitcoin Legacy', async () => {
      it('should fetch a single Bitcoin address', async () => {
        const startPath = [
          PURPOSES.BTC_LEGACY,
          COINS.BTC,
          HARDENED_OFFSET,
          0,
          0,
        ];
        const addrs = await client.getAddresses({ startPath, n: 1 });
        expect(addrs).toMatchInlineSnapshot(
          `
      [
        "1EugM4cE8AvbyATXKj18tRv7hk3NqTKHm7",
      ]
    `,
        );
      });

      it('should fetch many Bitcoin addresses', async () => {
        const startPath = [
          PURPOSES.BTC_LEGACY,
          COINS.BTC,
          HARDENED_OFFSET,
          0,
          0,
        ];
        const addrs = await client.getAddresses({ startPath, n: 10 });
        expect(addrs).toMatchInlineSnapshot(
          `
      [
        "1EugM4cE8AvbyATXKj18tRv7hk3NqTKHm7",
        "1K2akpdwq5VqANrc4XjV9fgZWgi6m6VSHA",
        "1JXqWwhW6xiLHVbJLV8kqJXu4ZwrGzKk2f",
        "1NX3dMAf9BSFroBmHfNrmuAHuYyjfMQ5er",
        "1Fj7EAQ7c392CRuyoatawo4r7PpyfRVzgJ",
        "1NMiCHqaVCZSwFTVWwtdNAoyswLVs7nhWt",
        "1NrknsRRYB4Xvjm78vhgkP6vageLCEdj4B",
        "1NTDhCU2XKFeKy1XwveaSAxt9Cgbu972YG",
        "1DC32CRmr4gwAJ1kmenzBg77M12hwc7QzA",
        "1MnJJnYEmkzVcR7DR1aGDDkg4jY1T76TD7",
      ]
    `,
        );
      });
    });

    describe('Bitcoin Segwit', async () => {
      it('should fetch a single Bitcoin address', async () => {
        const startPath = [
          PURPOSES.BTC_SEGWIT,
          COINS.BTC,
          HARDENED_OFFSET,
          0,
          0,
        ];
        const addrs = await client.getAddresses({ startPath, n: 1 });
        expect(addrs).toMatchInlineSnapshot(
          `
      [
        "1EugM4cE8AvbyATXKj18tRv7hk3NqTKHm7",
      ]
    `,
        );
      });

      it('should fetch many Bitcoin addresses', async () => {
        const startPath = [
          PURPOSES.BTC_SEGWIT,
          COINS.BTC,
          HARDENED_OFFSET,
          0,
          0,
        ];
        const addrs = await client.getAddresses({ startPath, n: 10 });
        expect(addrs).toMatchInlineSnapshot(
          `
      [
        "1EugM4cE8AvbyATXKj18tRv7hk3NqTKHm7",
        "1K2akpdwq5VqANrc4XjV9fgZWgi6m6VSHA",
        "1JXqWwhW6xiLHVbJLV8kqJXu4ZwrGzKk2f",
        "1NX3dMAf9BSFroBmHfNrmuAHuYyjfMQ5er",
        "1Fj7EAQ7c392CRuyoatawo4r7PpyfRVzgJ",
        "1NMiCHqaVCZSwFTVWwtdNAoyswLVs7nhWt",
        "1NrknsRRYB4Xvjm78vhgkP6vageLCEdj4B",
        "1NTDhCU2XKFeKy1XwveaSAxt9Cgbu972YG",
        "1DC32CRmr4gwAJ1kmenzBg77M12hwc7QzA",
        "1MnJJnYEmkzVcR7DR1aGDDkg4jY1T76TD7",
      ]
    `,
        );
      });
    });

    describe('Bitcoin Wrapped Segwit', async () => {
      it('should fetch a single Bitcoin address', async () => {
        const startPath = [
          PURPOSES.BTC_WRAPPED_SEGWIT,
          COINS.BTC,
          HARDENED_OFFSET,
          0,
          0,
        ];
        const addrs = await client.getAddresses({ startPath, n: 1 });
        expect(addrs).toMatchInlineSnapshot(
          `
      [
        "1EugM4cE8AvbyATXKj18tRv7hk3NqTKHm7",
      ]
    `,
        );
      });

      it('should fetch many Bitcoin addresses', async () => {
        const startPath = [
          PURPOSES.BTC_WRAPPED_SEGWIT,
          COINS.BTC,
          HARDENED_OFFSET,
          0,
          0,
        ];
        const addrs = await client.getAddresses({ startPath, n: 10 });
        expect(addrs).toMatchInlineSnapshot(
          `
      [
        "1EugM4cE8AvbyATXKj18tRv7hk3NqTKHm7",
        "1K2akpdwq5VqANrc4XjV9fgZWgi6m6VSHA",
        "1JXqWwhW6xiLHVbJLV8kqJXu4ZwrGzKk2f",
        "1NX3dMAf9BSFroBmHfNrmuAHuYyjfMQ5er",
        "1Fj7EAQ7c392CRuyoatawo4r7PpyfRVzgJ",
        "1NMiCHqaVCZSwFTVWwtdNAoyswLVs7nhWt",
        "1NrknsRRYB4Xvjm78vhgkP6vageLCEdj4B",
        "1NTDhCU2XKFeKy1XwveaSAxt9Cgbu972YG",
        "1DC32CRmr4gwAJ1kmenzBg77M12hwc7QzA",
        "1MnJJnYEmkzVcR7DR1aGDDkg4jY1T76TD7",
      ]
    `,
        );
      });
    });
  });

  describe.skip('Ethereum', async () => {
    it('should fetch a single address', async () => {
      const startPath = [PURPOSES.ETH, COINS.ETH, HARDENED_OFFSET, 0, 0];
      const addrs = await client.getAddresses({ startPath, n: 1 });
      expect(addrs).toMatchInlineSnapshot(`
        [
          "0x5714afb5d7767df76154cd0056086aa95fd7ff7e",
        ]
      `);
    });

    it('should fetch many addresses', async () => {
      const startPath = [PURPOSES.ETH, COINS.ETH, HARDENED_OFFSET, 0, 0];
      const addrs = await client.getAddresses({ startPath, n: 10 });
      expect(addrs).toMatchInlineSnapshot(`
        [
          "0x5714afb5d7767df76154cd0056086aa95fd7ff7e",
          "0x7e934472c41ae301ead73a64213c09c43d2c0e02",
          "0x0d9cb2a2d7f7a9fcc02ab127279c4dcf2b95748d",
          "0xb3cc855aa118d4f8d031da9ebe5e6510ff66d88b",
          "0xd335c896152f86ab538eb90db5654c9c8ea4cc64",
          "0xa44ee9bb5691b743a45f0f1950d4bb50a192125d",
          "0xff6dfb2ae2fc7a0a8319a315cd21e26e341d69c8",
          "0xaf83c867da6a2ea39408f9191866c5785308b10c",
          "0x8a5cc95c3a9beaf61809115d37cfca9cdd05196a",
          "0xb09d8ef0247b67e002b64fd9b7ef6afeaad5ae66",
        ]
      `);
    });
  });

  describe('Solana', async () => {
    it('should fetch a single address', async () => {
      const startPath = [PURPOSES.SOL, COINS.SOL, HARDENED_OFFSET];
      const addrs = await client.getAddresses({ startPath, n: 1, flag: 4 });
      expect(addrs[0].toString('hex')).toMatchInlineSnapshot(
        '"eaaca515b28d37d34f15290c82e15bae192c5781c39532f91df7ebf1e46288fa"',
      );
    });

    it('should fetch a single address at index 2', async () => {
      const startPath = [PURPOSES.SOL, COINS.SOL, HARDENED_OFFSET + 1];
      const addrs = await client.getAddresses({ startPath, n: 1, flag: 4 });
      expect(addrs[0].toString('hex')).toMatchInlineSnapshot(
        '"a353495b7d687933d3a936284c1fb0148e1bd8b93451abbc06ff907ccaa49a4e"',
      );
    });

    it('should fetch a many addresses', async () => {
      const startPath = [PURPOSES.SOL, COINS.SOL, HARDENED_OFFSET];
      const addrs = await client.getAddresses({ startPath, n: 10, flag: 4 });
      expect(addrs.map((addr) => addr.toString('hex'))).toMatchInlineSnapshot(`
        [
          "eaaca515b28d37d34f15290c82e15bae192c5781c39532f91df7ebf1e46288fa",
          "a353495b7d687933d3a936284c1fb0148e1bd8b93451abbc06ff907ccaa49a4e",
          "046991be681442cb7af1eac482471fa5b769036600bb7712e5d371afd68af562",
          "a489ef37ba2735a1948f47feb20a691d07651e7065898a7092e124ee714b1486",
          "1e2c5ae4216d7f323341fea8602d6874ba8a0fc71cb39ebba35c5e063b563b3b",
          "e084e549d69ef1f2f199eb1394b29a1c22d08241cfe81cae57dcd3c154252c52",
          "e5c155b2b2ce4decd5faa43dde7d43ef96641f3c9964cf4bbbb547e3107bcf50",
          "6bc09b5720969a4168b65bd043b26e5f0b40437af54cba99328c051be12ab470",
          "8e127c4e632bd8164b07653bb0fd8579e5e51e6cc35f6d2cd99ea55de3e27566",
          "0d73618ae370b2ab78c2e3235a68d427884adeafd6fb9c692715fecce557ce15",
        ]
      `);
    });
  });
});
