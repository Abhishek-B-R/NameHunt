import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello from Hono + Bun!'))

export default {
  port: 8080,
  fetch: app.fetch,
}

