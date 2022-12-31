import {
  decodeConnectResponse,
  decodeGetAddressesResponse,
  decodeGetKvRecordsResponse,
  decodeFetchEncData,
  decodeSignResponse,
} from '../../functions';
import {
  clientKeyPair,
  decoderTestsFwConstants,
  connectDecoderData,
  getAddressesFlag,
  getAddressesDecoderData,
  signBitcoinRequest,
  signBitcoinDecoderData,
  signGenericRequest,
  signGenericDecoderData,
  getKvRecordsDecoderData,
  fetchEncryptedDataRequest,
  fetchEncryptedDataDecoderData,
} from './__mocks__/decoderData';

describe('decoders', () => {

  test('connect', () => {
    expect(
      decodeConnectResponse(connectDecoderData, clientKeyPair),
    ).toMatchSnapshot();
  });

  test('getAddresses', () => {
    expect(
      decodeGetAddressesResponse(
        getAddressesDecoderData, 
        getAddressesFlag
      ),
    ).toMatchSnapshot();
  });

  test('sign - bitcoin', () => {
    const params:DecodeSignResponseParams = {
      data: signBitcoinDecoderData,
      request: signBitcoinRequest,
      isGeneric: false,
      currency: 'BTC',
    }
    expect(
      decodeSignResponse(params),
    ).toMatchSnapshot();
  });

  test('sign - generic', () => {
    const params:DecodeSignResponseParams = {
      data: signGenericDecoderData,
      request: signGenericRequest,
      isGeneric: true,
    }
    expect(
      decodeSignResponse(params),
    ).toMatchSnapshot();
  });

  test('getKvRecords', () => {
    expect(
      decodeGetKvRecordsResponse(getKvRecordsDecoderData, decoderTestsFwConstants),
    ).toMatchSnapshot();
  });

  test('fetchEncryptedData', () => {
    // This test is different than the others because one part of the data is
    // randomly generated (UUID) before the response is returned. 
    // We will just zero it out for testing purposes.
    const decoded = decodeFetchEncData(fetchEncryptedDataDecoderData, fetchEncryptedDataRequest);
    const decodedDerp = JSON.parse(decoded.toString())
    decodedDerp.uuid = '00000000-0000-0000-0000-000000000000';
    expect(
      Buffer.from(JSON.stringify(decodedDerp))
    ).toMatchSnapshot();
  });

});
