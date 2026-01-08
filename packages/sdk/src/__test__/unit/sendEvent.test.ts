import { __private__ as sendEventPrivate } from '../../functions/sendEvent';

const { encodeEventPayload } = sendEventPrivate;

describe('sendEvent encoding', () => {
  it('encodes and pads message payload', () => {
    const payload = encodeEventPayload({
      eventType: 1,
      eventId: '00000000-0000-0000-0000-000000000000',
      message: 'hi',
    });
    expect(payload.length).toBe(1722);
    expect(payload[0]).toBe(1);
    expect(payload.slice(1, 17).every((b) => b === 0)).toBe(true);
    expect(payload.readUInt16LE(17)).toBe(2);
    expect(payload.slice(19, 21).toString('utf8')).toBe('hi');
    expect(payload.slice(21).every((b) => b === 0)).toBe(true);
  });

  it('throws on empty message', () => {
    expect(() =>
      encodeEventPayload({
        eventType: 1,
        eventId: '00000000-0000-0000-0000-000000000000',
        message: '',
      }),
    ).toThrow(/must not be empty/i);
  });

  it('throws when message is too long', () => {
    const longMsg = 'a'.repeat(1704);
    expect(() =>
      encodeEventPayload({
        eventType: 1,
        eventId: '00000000-0000-0000-0000-000000000000',
        message: longMsg,
      }),
    ).toThrow(/too long/i);
  });

  it('throws on invalid eventId', () => {
    expect(() =>
      encodeEventPayload({
        eventType: 1,
        eventId: 'not-a-uuid',
        message: 'hi',
      }),
    ).toThrow(/eventId/i);
  });

  it('throws on invalid eventType', () => {
    expect(() =>
      encodeEventPayload({
        eventType: 256,
        eventId: '00000000-0000-0000-0000-000000000000',
        message: 'hi',
      }),
    ).toThrow(/eventType/i);
  });
});
