import { server } from './server'

export const setup = () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())
}