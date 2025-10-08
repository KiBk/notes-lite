import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createServer } from '../src/app.js'

const originalDbPath = process.env.DATABASE_PATH

const createTestServer = (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-server-'))
  const dbPath = path.join(tmpDir, 'notes.db')
  process.env.DATABASE_PATH = dbPath
  const server = createServer()

  t.after(() => {
    server.close()
    process.env.DATABASE_PATH = originalDbPath
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  return server
}

test('routes enforce identifiers and surface validation errors', async (t) => {
  const { app } = createTestServer(t)

  const emptyUser = await request(app).get('/api/users/%20/store')
  assert.equal(emptyUser.status, 400)
  assert.match(emptyUser.body.message, /User id is required/)

  const emptyNote = await request(app)
    .patch('/api/users/valid/notes/%20')
    .send({ title: 'noop' })
  assert.equal(emptyNote.status, 400)
  assert.match(emptyNote.body.message, /Note id is required/)

  const invalidPayload = await request(app)
    .post('/api/users/pat/notes')
    .send({ color: 'blue' })
  assert.equal(invalidPayload.status, 400)
  assert.equal(invalidPayload.body.message, 'Validation failed')
  assert.ok(Array.isArray(invalidPayload.body.issues))
})

test('note mutations propagate not found responses', async (t) => {
  const { app } = createTestServer(t)

  const response = await request(app)
    .patch('/api/users/pat/notes/unknown')
    .send({ title: 'Missing' })

  assert.equal(response.status, 404)
  assert.equal(response.body.message, 'Note not found')
})

test('fallback 404 handler responds for unknown paths', async (t) => {
  const { app } = createTestServer(t)

  const response = await request(app).get('/totally-missing')
  assert.equal(response.status, 404)
  assert.equal(response.body.message, 'Not found')
})
