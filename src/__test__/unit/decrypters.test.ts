import {
  decryptPairResponse,
  decryptFetchActiveWalletResponse,
  decryptGetAddressesResponse,
  decryptSignResponse,
  decryptGetKvRecordsResponse,
  decryptAddKvRecordsResponse,
  decryptRemoveKvRecordsResponse,
} from '../../functions';
import {
  pairEncryptedResponse,
  fetchActiveWalletEncryptedResponse,
  getAddressesEncryptedResponse,
  signEncryptedResponse,
  getKvRecordsEncryptedResponse,
  addKvRecordsEncryptedResponse,
  removeKvRecordsEncryptedResponse,
} from './__mocks__/decryptersData';

describe('decrypters', () => {
  test('pair', () => {
    const encryptedResponse = pairEncryptedResponse;
    const sharedSecret = Buffer.from(
      '19c5bb9839d81eb975aed91b865728f10d5836d0a96497dae396d01da39cff9d',
      'hex',
    );
    const { decryptedData } = decryptPairResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });

  test('fetchActiveWallet', () => {
    const encryptedResponse = fetchActiveWalletEncryptedResponse;
    const sharedSecret = Buffer.from(
      '7b42b92db38d6b154fd6855d2793b1bd6b74cc4ebc022720a89d890fed39d271',
      'hex',
    );
    const { decryptedData } = decryptFetchActiveWalletResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });

  test('getAddresses', () => {
    const encryptedResponse = getAddressesEncryptedResponse;
    const sharedSecret = Buffer.from(
      'ea07e69e110c91daa1956f9fd09d02a3926c90a23e2194edc44c5a072760b0d2',
      'hex',
    );
    const { decryptedData } = decryptGetAddressesResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });

  test('sign', () => {
    const encryptedResponse = signEncryptedResponse;
    const sharedSecret = Buffer.from(
      '7fd212816bc3f786a105dc2c1f1427ba16c82895ae2ca2ab0ab5aa74333da5c1',
      'hex',
    );
    const { decryptedData } = decryptSignResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });

  test('getKvRecords', () => {
    const encryptedResponse = getKvRecordsEncryptedResponse;
    const sharedSecret = Buffer.from(
      'fd9a2e92003c72c574f4b7f5a52c81ac75eabbba1530cea6b88e5fe759fa5d68',
      'hex',
    );
    const { decryptedData } = decryptGetKvRecordsResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });

  test('addKvRecords', () => {
    const encryptedResponse = addKvRecordsEncryptedResponse;
    const sharedSecret = Buffer.from(
      '7d07d7b0116de8e1fc7beefdf79ce0ac0c6f5550aad2a5df65d556282a3b7d2f',
      'hex',
    );
    const { decryptedData } = decryptAddKvRecordsResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });

  test('removeKvRecords', () => {
    const encryptedResponse = removeKvRecordsEncryptedResponse;
    const sharedSecret = Buffer.from(
      'fbf8c2922e33023b1cb4478ce7316b92a1a275e87b18ea7940e2eef31cf35f8a',
      'hex',
    );
    const { decryptedData } = decryptRemoveKvRecordsResponse(
      encryptedResponse,
      sharedSecret,
    );
    expect(decryptedData.toString('hex')).toMatchSnapshot();
  });
});
