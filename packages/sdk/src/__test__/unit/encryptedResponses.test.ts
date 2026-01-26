import {
  LatticeSecureEncryptedRequestType,
  ProtocolConstants,
  encryptedSecureRequest,
} from '../../protocol';
import { aes256_encrypt, checksum, getP256KeyPair } from '../../util';
import { request } from '../../shared/functions';

vi.mock('../../shared/functions', async () => {
  const actual = await vi.importActual<typeof import('../../shared/functions')>(
    '../../shared/functions',
  );
  return {
    ...actual,
    request: vi.fn(),
  };
});

const requestMock = vi.mocked(request);

const buildEncryptedResponse = ({
  sharedSecret,
  requestType,
  status,
  responsePub,
}: {
  sharedSecret: Buffer;
  requestType: LatticeSecureEncryptedRequestType;
  status: number;
  responsePub: Buffer;
}) => {
  const responseDataSize =
    ProtocolConstants.msgSizes.secure.data.response.encrypted[requestType];
  const decrypted = Buffer.alloc(
    ProtocolConstants.msgSizes.secure.data.response.encrypted.encryptedData,
  );
  responsePub.copy(decrypted, 0);
  decrypted[responsePub.length] = status;
  const checksumOffset = responsePub.length + responseDataSize;
  const cs = checksum(decrypted.slice(0, checksumOffset));
  decrypted.writeUInt32BE(cs, checksumOffset);
  return aes256_encrypt(decrypted, sharedSecret);
};

describe('encryptedSecureRequest response sizes', () => {
  const requestType = LatticeSecureEncryptedRequestType.event;
  const sharedSecret = Buffer.alloc(32, 7);
  const ephemeralPub = getP256KeyPair(Buffer.alloc(32, 3));
  const requestData = Buffer.alloc(
    ProtocolConstants.msgSizes.secure.data.request.encrypted[requestType],
  );
  const responseKey = getP256KeyPair(Buffer.alloc(32, 9));
  const responsePub = Buffer.from(
    responseKey.getPublic().encode('hex', false),
    'hex',
  );

  beforeEach(() => {
    requestMock.mockReset();
  });

  it('accepts compact encrypted response size', async () => {
    const encryptedResponse = buildEncryptedResponse({
      sharedSecret,
      requestType,
      status: 0,
      responsePub,
    });
    requestMock.mockResolvedValueOnce(encryptedResponse);

    const result = await encryptedSecureRequest({
      data: requestData,
      requestType,
      sharedSecret,
      ephemeralPub,
      url: 'http://example.test',
    });

    expect(result.decryptedData[0]).toBe(0);
  });

  it('accepts legacy encrypted response size', async () => {
    const encryptedResponse = buildEncryptedResponse({
      sharedSecret,
      requestType,
      status: 0,
      responsePub,
    });
    const legacyResponse = Buffer.concat([
      encryptedResponse,
      Buffer.alloc(encryptedResponse.length),
    ]);
    requestMock.mockResolvedValueOnce(legacyResponse);

    const result = await encryptedSecureRequest({
      data: requestData,
      requestType,
      sharedSecret,
      ephemeralPub,
      url: 'http://example.test',
    });

    expect(result.decryptedData[0]).toBe(0);
  });
});
