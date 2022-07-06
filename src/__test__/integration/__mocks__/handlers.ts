import { rest } from 'msw'
import connectResponse from './connect.json'
import getAddressesResponse from './getAddresses.json'
import signResponse from './sign.json'
import fetchActiveWalletResponse from './fetchActiveWallet.json'
import addKvRecordsResponse from './addKvRecords.json'
import getKvRecordsResponse from './getKvRecords.json'
import removeKvRecordsResponse from './removeKvRecords.json'
import {
  etherscanResponse0xa0b86991,
  etherscanResponse0x7a250d56,
} from './etherscan'
import {
  fourbyteResponse0x38ed1739,
  fourbyteResponse0xa9059cbb,
} from './4byte'

export const handlers = [
  rest.post('https://signing.gridpl.us/test/connect', (req, res, ctx) => {
    return res(ctx.json(connectResponse))
  }),
  rest.post('https://signing.gridpl.us/test/getAddresses', (req, res, ctx) => {
    return res(ctx.json(getAddressesResponse))
  }),
  rest.post('https://signing.gridpl.us/test/sign', (req, res, ctx) => {
    return res(ctx.json(signResponse))
  }),
  rest.post('https://signing.gridpl.us/test/fetchActiveWallet', (req, res, ctx) => {
    return res(ctx.json(fetchActiveWalletResponse))
  }),
  rest.post('https://signing.gridpl.us/test/addKvRecords', (req, res, ctx) => {
    return res(ctx.json(addKvRecordsResponse))
  }),
  rest.post('https://signing.gridpl.us/test/getKvRecords', (req, res, ctx) => {
    return res(ctx.json(getKvRecordsResponse))
  }),
  rest.post('https://signing.gridpl.us/test/removeKvRecords', (req, res, ctx) => {
    return res(ctx.json(removeKvRecordsResponse))
  }),
  rest.get('https://api.etherscan.io/api', (req, res, ctx) => {
    const module = req.url.searchParams.get('module')
    const action = req.url.searchParams.get('action')
    const address = req.url.searchParams.get('address')

    if (module === 'contract' && action === 'getabi') {
      if (address === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') {
        return res(
          ctx.json({ result: JSON.stringify(etherscanResponse0xa0b86991) }),
        )
      }
      if (address === '0x7a250d5630b4cf539739df2c5dacb4c659f2488d') {
        return res(
          ctx.json({ result: JSON.stringify(etherscanResponse0x7a250d56) }),
        )
      }
    }
  }),
  rest.get('https://www.4byte.directory/api/v1/signatures', (req, res, ctx) => {
    const hexSignature = req.url.searchParams.get('hex_signature')
    if (hexSignature === '0xa9059cbb') {
      return res(ctx.json(fourbyteResponse0xa9059cbb))
    }
    if (hexSignature === '0x38ed1739') {
      return res(ctx.json(fourbyteResponse0x38ed1739))
    }
  }),
]