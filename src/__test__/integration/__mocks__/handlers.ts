import { http, HttpResponse } from 'msw';
import connectResponse from './connect.json';
import getAddressesResponse from './getAddresses.json';
import signResponse from './sign.json';
import fetchActiveWalletResponse from './fetchActiveWallet.json';
import addKvRecordsResponse from './addKvRecords.json';
import getKvRecordsResponse from './getKvRecords.json';
import removeKvRecordsResponse from './removeKvRecords.json';
import {
  etherscanResponse0x06412d7e,
  etherscanResponse0x7a250d56,
  etherscanResponse0xa0b86991,
  etherscanResponse0xc36442b6,
} from './etherscan';
import {
  fourbyteResponse0c49ccbe,
  fourbyteResponse0x38ed1739,
  fourbyteResponse0x6a761202,
  fourbyteResponse0xa9059cbb,
  fourbyteResponseac9650d8,
  fourbyteResponsefc6f7865,
} from './4byte';

export const handlers = [
  http.post('https://signing.gridpl.us/test/connect', () => {
    return HttpResponse.json(connectResponse);
  }),
  http.post('https://signing.gridpl.us/test/getAddresses', () => {
    return HttpResponse.json(getAddressesResponse);
  }),
  http.post('https://signing.gridpl.us/test/sign', () => {
    return HttpResponse.json(signResponse);
  }),
  http.post('https://signing.gridpl.us/test/fetchActiveWallet', () => {
    return HttpResponse.json(fetchActiveWalletResponse);
  }),
  http.post('https://signing.gridpl.us/test/addKvRecords', () => {
    return HttpResponse.json(addKvRecordsResponse);
  }),
  http.post('https://signing.gridpl.us/test/getKvRecords', () => {
    return HttpResponse.json(getKvRecordsResponse);
  }),
  http.post('https://signing.gridpl.us/test/removeKvRecords', () => {
    return HttpResponse.json(removeKvRecordsResponse);
  }),
  http.get('https://api.etherscan.io/api', ({ request }) => {
    const url = new URL(request.url);
    const module = url.searchParams.get('module');
    const action = url.searchParams.get('action');
    const address = url.searchParams.get('address');

    if (module === 'contract' && action === 'getabi') {
      if (address === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') {
        return HttpResponse.json({
          result: JSON.stringify(etherscanResponse0xa0b86991),
        });
      }
      if (address === '0x7a250d5630b4cf539739df2c5dacb4c659f2488d') {
        return HttpResponse.json({
          result: JSON.stringify(etherscanResponse0x7a250d56),
        });
      }
      if (address === '0xc36442b4a4522e871399cd717abdd847ab11fe88') {
        return HttpResponse.json({
          result: JSON.stringify(etherscanResponse0xc36442b6),
        });
      }
      if (address === '0x06412d7ebfbf66c25607e2ed24c1d207043be327') {
        return HttpResponse.json({
          result: JSON.stringify(etherscanResponse0x06412d7e),
        });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),
  http.get('https://www.4byte.directory/api/v1/signatures', ({ request }) => {
    const url = new URL(request.url);
    const hexSignature = url.searchParams.get('hex_signature');
    if (hexSignature === '0xa9059cbb') {
      return HttpResponse.json(fourbyteResponse0xa9059cbb);
    }
    if (hexSignature === '0x38ed1739') {
      return HttpResponse.json(fourbyteResponse0x38ed1739);
    }
    if (hexSignature === '0xac9650d8') {
      return HttpResponse.json(fourbyteResponseac9650d8);
    }
    if (hexSignature === '0x0c49ccbe') {
      return HttpResponse.json(fourbyteResponse0c49ccbe);
    }
    if (hexSignature === '0xfc6f7865') {
      return HttpResponse.json(fourbyteResponsefc6f7865);
    }
    if (hexSignature === '0x6a761202') {
      return HttpResponse.json(fourbyteResponse0x6a761202);
    }
    return new HttpResponse(null, { status: 404 });
  }),
];
