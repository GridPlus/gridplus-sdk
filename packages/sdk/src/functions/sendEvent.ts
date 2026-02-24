import {
  LatticeSecureEncryptedRequestType,
  encryptedSecureRequest,
} from '../protocol';
import { parse as parseUuid, validate as validateUuid } from 'uuid';
import { validateConnectedClient } from '../shared/validators';
import type {
  SendEventRequestFunctionParams,
  SendEventResponse,
} from '../types';

const EVENT_TYPE_BYTES = 1;
const EVENT_ID_BYTES = 16;
const MESSAGE_LENGTH_BYTES = 2;
const MAX_MESSAGE_BYTES = 1703;
const EVENT_PAYLOAD_BYTES =
  EVENT_TYPE_BYTES + EVENT_ID_BYTES + MESSAGE_LENGTH_BYTES + MAX_MESSAGE_BYTES;

const parseEventId = (eventId: string): Buffer => {
  if (!validateUuid(eventId)) {
    throw new Error('eventId must be a valid UUID.');
  }
  const bytes = Buffer.from(parseUuid(eventId));
  if (bytes.length !== EVENT_ID_BYTES) {
    throw new Error('eventId must be 16 bytes.');
  }
  return bytes;
};

const validateEventType = (eventType: number) => {
  if (!Number.isInteger(eventType) || eventType < 0 || eventType > 0xff) {
    throw new Error('eventType must be a uint8.');
  }
};

const encodeEventPayload = ({
  eventType,
  eventId,
  message,
}: {
  eventType: number;
  eventId: string;
  message: string;
}): Buffer => {
  validateEventType(eventType);
  const msgBytes = Buffer.from(message, 'utf8');
  if (msgBytes.length === 0) {
    throw new Error('Message must not be empty.');
  }
  if (msgBytes.length > MAX_MESSAGE_BYTES) {
    throw new Error(
      `Message is too long. Max length is ${MAX_MESSAGE_BYTES} bytes.`,
    );
  }

  const payload = Buffer.alloc(EVENT_PAYLOAD_BYTES);
  const eventIdBytes = parseEventId(eventId);
  payload[0] = eventType;
  eventIdBytes.copy(payload, EVENT_TYPE_BYTES);
  payload.writeUInt16LE(msgBytes.length, EVENT_TYPE_BYTES + EVENT_ID_BYTES);
  msgBytes.copy(
    payload,
    EVENT_TYPE_BYTES + EVENT_ID_BYTES + MESSAGE_LENGTH_BYTES,
  );
  return payload;
};

/** Send an event payload to device firmware. */
export const sendEvent = async ({
  client,
  eventType,
  eventId,
  message,
}: SendEventRequestFunctionParams): Promise<SendEventResponse> => {
  const { url, sharedSecret, ephemeralPub } = validateConnectedClient(client);
  const data = encodeEventPayload({ eventType, eventId, message });

  const { decryptedData, newEphemeralPub } = await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.event,
    sharedSecret,
    ephemeralPub,
    url,
  });

  client.mutate({ ephemeralPub: newEphemeralPub });

  return { status: decryptedData[0] ?? 0 };
};

export const __private__ = { encodeEventPayload };
