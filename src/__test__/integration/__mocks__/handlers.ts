import { rest } from 'msw'
import connectResponse from './connect.json'
import getAddressesResponse from './getAddresses.json'
import signResponse from './sign.json'
import fetchActiveWalletResponse from './fetchActiveWallet.json'
import addKvRecordsResponse from './addKvRecords.json'
import getKvRecordsResponse from './getKvRecords.json'
import removeKvRecordsResponse from './removeKvRecords.json'

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
]