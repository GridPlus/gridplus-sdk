import type { Client } from '../client';

/** Parameters required to send a device event. */
export interface SendEventParams {
  /** Firmware event type code (uint8). */
  eventType: number;
  /** UUID v4 string used by firmware to dedupe events. */
  eventId: string;
  /** UTF-8 serialized event payload to display on the device. */
  message: string;
}

/** Arguments for the sendEvent function including the bound client. */
export interface SendEventRequestFunctionParams extends SendEventParams {
  /** Connected SDK client instance. */
  client: Client;
}

/** Response returned by the sendEvent request. */
export interface SendEventResponse {
  /** Firmware response status byte. */
  status: number;
}
