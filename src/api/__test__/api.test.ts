import { setup, connect, pair, sign } from '..';

describe('API', () => {
  test('pair', async () => {
    await setup('deviceId', 'pw', 'app name');
    await connect();
    await pair('pairing code');
  });

  test('sign', async () => {
    await sign({});
  });
});
