if (process.env.NODE_ENV !== 'production') {
  (async () => {
    const dotenv = await import('dotenv');
    dotenv.config();
  })()
}

export { CALLDATA as Calldata } from './calldata/index';
export { Client } from './client';
export { EXTERNAL as Constants } from './constants';
export { EXTERNAL as Utils } from './util'
