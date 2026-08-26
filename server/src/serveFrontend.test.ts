import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { attachFrontend, clientDistPath } from './serveFrontend.js'

describe('attachFrontend', () => {
  it('keeps /api routes on the JSON API when the frontend is attached', async () => {
    const app = createApp()
    attachFrontend(app)
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.headers['content-type']).toMatch(/json/)
  })

  it('serves index.html for tab paths when the client is built', async () => {
    if (!existsSync(`${clientDistPath()}/index.html`)) {
      return
    }
    const app = createApp()
    const attached = attachFrontend(app)
    expect(attached).toBe(true)

    const overview = await request(app).get('/overview')
    expect(overview.status).toBe(200)
    expect(overview.headers['content-type']).toMatch(/html/)
    expect(overview.text).toMatch(/<div id="root">/)

    const unknownTab = await request(app).get('/planning')
    expect(unknownTab.status).toBe(200)
    expect(unknownTab.text).toMatch(/<div id="root">/)

    const missingApi = await request(app).get('/api/does-not-exist')
    expect(missingApi.status).toBe(404)
    expect(missingApi.text).not.toMatch(/<div id="root">/)
  })
})
