import { Hono } from 'hono'

const app = new Hono()

app.post('/search', async (c) => {
  try {
    const body = await c.req.json<{ code: string }>()

    if (!body.code) {
      return c.json({ error: 'Field "code" is required' }, 400)
    }

    const code = body.code
    const lineCount = code.split('\n').length
    const charCount = code.length

    return c.json({
      message: 'Code received successfully!',
      stats: {
        lineCount,
        charCount,
        preview: code.slice(0, 100) + (code.length > 100 ? '...' : ''),
      },
    })
  } catch (error) {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }
})

export default {
  port: 8080,
  fetch: app.fetch,
}

