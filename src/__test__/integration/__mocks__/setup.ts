import { server } from './server'

export const setup = () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())
}