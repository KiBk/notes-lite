import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ZodError } from 'zod'
import { createNoteService } from '../src/note-service.js'
import { runMigrations } from '../src/db.js'
import { HttpError } from '../src/errors.js'

const setupService = (t) => {
  const db = new Database(':memory:')
  runMigrations(db)
  const service = createNoteService(db)
  t.after(() => {
    db.close()
  })
  return service
}

test('createNote hydrates defaults and appends to correct bucket', (t) => {
  const service = setupService(t)
  const user = 'alpha'

  const first = service.createNote(user)
  assert.equal(first.title, '')
  assert.equal(first.body, '')
  assert.equal(first.color, '#fde2e4')
  assert.equal(first.pinned, false)
  assert.equal(first.archived, false)

  const pinned = service.createNote(user, { pinned: true, title: 'Pinned' })
  const archived = service.createNote(user, { archived: true, title: 'Filed' })

  const store = service.getUserStore(user)
  assert.deepEqual(store.unpinnedOrder, [first.id])
  assert.deepEqual(store.pinnedOrder, [pinned.id])
  assert.deepEqual(store.archivedOrder, [archived.id])
})

test('createNote enforces payload validation and flag exclusivity', async (t) => {
  const service = setupService(t)
  const user = 'beta'

  await t.test('rejects oversized title/body', () => {
    assert.throws(
      () => service.createNote(user, { title: 'a'.repeat(513) }),
      (error) => error instanceof ZodError,
    )
    assert.throws(
      () => service.createNote(user, { body: 'b'.repeat(5001) }),
      (error) => error instanceof ZodError,
    )
  })

  await t.test('rejects invalid hex colours', () => {
    assert.throws(
      () => service.createNote(user, { color: '#1234' }),
      (error) => error instanceof ZodError && error.issues?.[0]?.message.includes('hex'),
    )
  })

  await t.test('rejects pinned + archived combination', () => {
    assert.throws(
      () => service.createNote(user, { pinned: true, archived: true }),
      (error) => error instanceof HttpError && error.status === 400 && /pinned and archived/.test(error.message),
    )
  })
})

test('createNote allocates next order position per bucket', (t) => {
  const service = setupService(t)
  const user = 'charlie'

  const pinnedA = service.createNote(user, { pinned: true, title: 'A' })
  const pinnedB = service.createNote(user, { pinned: true, title: 'B' })
  const unpinned = service.createNote(user, { title: 'C' })
  const archived = service.createNote(user, { archived: true, title: 'D' })

  const store = service.getUserStore(user)
  assert.deepEqual(store.pinnedOrder, [pinnedA.id, pinnedB.id])
  assert.deepEqual(store.unpinnedOrder, [unpinned.id])
  assert.deepEqual(store.archivedOrder, [archived.id])
})

test('updateNote migrates between buckets and preserves order semantics', async (t) => {
  const service = setupService(t)
  const user = 'delta'

  const pinned = service.createNote(user, { pinned: true, title: 'Pinned' })
  const unpinned = service.createNote(user, { title: 'Unpinned' })

  const updated = service.updateNote(user, pinned.id, { pinned: false })
  assert.equal(updated.pinned, false)

  let store = service.getUserStore(user)
  assert.deepEqual(store.pinnedOrder, [])
  assert.deepEqual(store.unpinnedOrder, [unpinned.id, pinned.id])

  const archived = service.updateNote(user, unpinned.id, { archived: true })
  assert.equal(archived.archived, true)
  store = service.getUserStore(user)
  assert.deepEqual(store.archivedOrder, [unpinned.id])
  assert.deepEqual(store.unpinnedOrder, [pinned.id])

  const revived = service.updateNote(user, unpinned.id, { archived: false })
  assert.equal(revived.archived, false)
  store = service.getUserStore(user)
  assert.deepEqual(store.unpinnedOrder, [pinned.id, unpinned.id])

  await t.test('throws when note is missing', () => {
    assert.throws(
      () => service.updateNote(user, 'missing-note', { title: 'Nope' }),
      (error) => error instanceof HttpError && error.status === 404,
    )
  })
})

test('reorderBucket updates positions and guards malformed payloads', async (t) => {
  const db = new Database(':memory:')
  runMigrations(db)
  const service = createNoteService(db)
  t.after(() => db.close())

  const user = 'echo'

  const a = service.createNote(user, { title: 'A' })
  const b = service.createNote(user, { title: 'B' })
  const c = service.createNote(user, { title: 'C' })

  service.reorderBucket(user, 'unpinned', { order: [c.id, a.id, b.id] })
  let store = service.getUserStore(user)
  assert.deepEqual(store.unpinnedOrder, [c.id, a.id, b.id])

  db.prepare('UPDATE note_orders SET position = position + 10 WHERE user_id = ? AND bucket = ?').run(
    user,
    'unpinned',
  )

  service.reorderBucket(user, 'unpinned', { order: [b.id, c.id, a.id] })
  store = service.getUserStore(user)
  assert.deepEqual(store.unpinnedOrder, [b.id, c.id, a.id])

  await t.test('rejects duplicate ids', () => {
    assert.throws(
      () => service.reorderBucket(user, 'unpinned', { order: [a.id, a.id, b.id] }),
      (error) => error instanceof HttpError && error.status === 400 && /duplicate/i.test(error.message),
    )
  })

  await t.test('rejects missing ids', () => {
    assert.throws(
      () => service.reorderBucket(user, 'unpinned', { order: [a.id, b.id] }),
      (error) => error instanceof HttpError && error.status === 400 && /include all notes/i.test(error.message),
    )
  })

  const pinned = service.createNote(user, { pinned: true, title: 'Pinned' })
  service.reorderBucket(user, 'pinned', { order: [pinned.id] })

  await t.test('rejects ids from the wrong bucket', () => {
    assert.throws(
      () => service.reorderBucket(user, 'pinned', { order: [a.id] }),
      (error) => error instanceof HttpError && error.status === 400 && /does not belong/.test(error.message),
    )
  })

  await t.test('rejects unsupported buckets', () => {
    assert.throws(
      () => service.reorderBucket(user, 'unknown', { order: [] }),
      (error) => error instanceof HttpError && error.status === 400 && /Unsupported bucket/.test(error.message),
    )
  })
})
