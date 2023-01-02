import { Transaction } from '@ethereumjs/tx';
import { connect, sign } from '@gridplus/react';

const tx = new Transaction({
  to: '0x1234',
  value: '0x1234',
  data: '0x1234',
  nonce: 1,
});

connect('deviceId').then(() => sign(tx));
