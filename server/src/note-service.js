import { randomUUID } from 'crypto'
import { z } from 'zod'
import { badRequest, notFound } from './errors.js'

const DEFAULT_COLOR = '#fde2e4'

const createNoteSchema = z
  .object({
    title: z.string().max(512).optional(),
    body: z.string().max(5000).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6 digit hex value').optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()

const updateNoteSchema = createNoteSchema.refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided when updating a note'
)

const reorderSchema = z
  .object({
    order: z.array(z.string().min(1)).optional(),
  })
  .strict()

const NOTE_BUCKETS = ['pinned', 'unpinned', 'archived']

const bucketFromFlags = (pinned, archived) => {
  if (archived) return 'archived'
  if (pinned) return 'pinned'
  return 'unpinned'
}

const coerceBoolean = (value) => (value ? 1 : 0)

const rowToNote = (row) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  color: row.color,
  pinned: Boolean(row.pinned),
  archived: Boolean(row.archived),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const createNoteService = (db) => {
  const ensureUserStmt = db.prepare(
    `INSERT OR IGNORE INTO users (id, created_at, updated_at)
     VALUES (?, datetime('now'), datetime('now'))`
  )
  const touchUserStmt = db.prepare(
    `UPDATE users SET updated_at = datetime('now')
     WHERE id = ?`
  )
  const selectNoteStmt = db.prepare(
    `SELECT id, title, body, color, pinned, archived, created_at, updated_at
     FROM notes WHERE user_id = ? AND id = ?`
  )
  const selectAllNotesStmt = db.prepare(
    `SELECT id, title, body, color, pinned, archived, created_at, updated_at
     FROM notes WHERE user_id = ?`
  )
  const insertNoteStmt = db.prepare(
    `INSERT INTO notes (id, user_id, title, body, color, pinned, archived, created_at, updated_at)
     VALUES (@id, @user_id, @title, @body, @color, @pinned, @archived, @created_at, @updated_at)`
  )
  const updateNoteStmt = db.prepare(
    `UPDATE notes
       SET title = @title,
           body = @body,
           color = @color,
           pinned = @pinned,
           archived = @archived,
           updated_at = @updated_at
     WHERE id = @id AND user_id = @user_id`
  )
  const deleteNoteStmt = db.prepare(`DELETE FROM notes WHERE user_id = ? AND id = ?`)
  const selectOrdersStmt = db.prepare(
    `SELECT note_id, bucket, position
       FROM note_orders
      WHERE user_id = ?
   ORDER BY bucket, position`
  )
  const selectBucketOrderStmt = db.prepare(
    `SELECT note_id
       FROM note_orders
      WHERE user_id = ? AND bucket = ?
   ORDER BY position`
  )
  const nextOrderPositionStmt = db.prepare(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
       FROM note_orders
      WHERE user_id = ? AND bucket = ?`
  )
  const insertOrderStmt = db.prepare(
    `INSERT INTO note_orders (user_id, note_id, bucket, position)
     VALUES (?, ?, ?, ?)`
  )
  const updateOrderBucketStmt = db.prepare(
    `UPDATE note_orders
        SET bucket = ?, position = ?
      WHERE user_id = ? AND note_id = ?`
  )
  const updateOrderPositionStmt = db.prepare(
    `UPDATE note_orders
        SET position = ?
      WHERE user_id = ? AND note_id = ?`
  )

  const deleteOrderStmt = db.prepare(
    `DELETE FROM note_orders WHERE user_id = ? AND note_id = ?`
  )

  const selectNoteExistsStmt = db.prepare(
    `SELECT id, pinned, archived FROM notes WHERE user_id = ? AND id = ?`
  )

  const ensureUser = (userId) => {
    ensureUserStmt.run(userId)
  }

  const getUserStore = (userId) => {
    ensureUser(userId)
    const noteRows = selectAllNotesStmt.all(userId)
    const notes = {}
    noteRows.forEach((row) => {
      notes[row.id] = rowToNote(row)
    })

    const orderRows = selectOrdersStmt.all(userId)
    const buckets = {
      pinned: [],
      unpinned: [],
      archived: [],
    }
    const seen = new Set()

    orderRows.forEach((row) => {
      const note = notes[row.note_id]
      if (!note) {
        // orphan order; clean up lazily
        deleteOrderStmt.run(userId, row.note_id)
        return
      }
      if (!NOTE_BUCKETS.includes(row.bucket)) {
        return
      }
      buckets[row.bucket].push(row.note_id)
      seen.add(row.note_id)
    })

    Object.entries(notes).forEach(([id, note]) => {
      if (seen.has(id)) return
      const bucket = bucketFromFlags(note.pinned, note.archived)
      buckets[bucket].push(id)
    })

    return {
      notes,
      pinnedOrder: buckets.pinned,
      unpinnedOrder: buckets.unpinned,
      archivedOrder: buckets.archived,
    }
  }

  const assertFlags = ({ pinned, archived }) => {
    if (pinned && archived) {
      throw badRequest('A note cannot be both pinned and archived at the same time')
    }
  }

  const createNote = (userId, payload = {}) => {
    ensureUser(userId)
    const data = createNoteSchema.parse(payload)
    const pinned = data.pinned ?? false
    const archived = data.archived ?? false
    assertFlags({ pinned, archived })

    const now = new Date().toISOString()
    const note = {
      id: randomUUID(),
      user_id: userId,
      title: data.title ?? '',
      body: data.body ?? '',
      color: data.color ?? DEFAULT_COLOR,
      pinned: coerceBoolean(pinned),
      archived: coerceBoolean(archived),
      created_at: now,
      updated_at: now,
    }

    const bucket = bucketFromFlags(pinned, archived)
    const nextPositionRow = nextOrderPositionStmt.get(userId, bucket)
    const position = nextPositionRow?.next_position ?? 0

    const insertTx = db.transaction(() => {
      insertNoteStmt.run(note)
      insertOrderStmt.run(userId, note.id, bucket, position)
      touchUserStmt.run(userId)
    })

    insertTx()

    return rowToNote(note)
  }

  const updateNote = (userId, noteId, payload) => {
    ensureUser(userId)
    const existingRow = selectNoteStmt.get(userId, noteId)
    if (!existingRow) {
      throw notFound('Note not found')
    }

    const update = updateNoteSchema.parse(payload)

    const pinned = update.pinned ?? existingRow.pinned === 1
    const archived = update.archived ?? existingRow.archived === 1
    assertFlags({ pinned, archived })

    const next = {
      id: noteId,
      user_id: userId,
      title: update.title ?? existingRow.title,
      body: update.body ?? existingRow.body,
      color: update.color ?? existingRow.color,
      pinned: coerceBoolean(pinned),
      archived: coerceBoolean(archived),
      updated_at: new Date().toISOString(),
    }

    const bucketBefore = bucketFromFlags(Boolean(existingRow.pinned), Boolean(existingRow.archived))
    const bucketAfter = bucketFromFlags(pinned, archived)

    const tx = db.transaction(() => {
      updateNoteStmt.run(next)
      if (bucketBefore !== bucketAfter) {
        deleteOrderStmt.run(userId, noteId)
        const nextPositionRow = nextOrderPositionStmt.get(userId, bucketAfter)
        const position = nextPositionRow?.next_position ?? 0
        insertOrderStmt.run(userId, noteId, bucketAfter, position)
      }
      touchUserStmt.run(userId)
    })

    tx()

    const updatedRow = selectNoteStmt.get(userId, noteId)
    return rowToNote(updatedRow)
  }

  const deleteNote = (userId, noteId) => {
    ensureUser(userId)
    const result = deleteNoteStmt.run(userId, noteId)
    if (result.changes === 0) {
      throw notFound('Note not found')
    }
    touchUserStmt.run(userId)
  }

  const reorderBucket = (userId, bucket, payload) => {
    ensureUser(userId)
    if (!NOTE_BUCKETS.includes(bucket)) {
      throw badRequest(`Unsupported bucket "${bucket}"`)
    }

    const data = reorderSchema.parse(payload ?? {})
    const order = data.order ?? []

    const current = selectBucketOrderStmt.all(userId, bucket).map((row) => row.note_id)

    const orderSet = new Set(order)
    if (order.length !== orderSet.size) {
      throw badRequest('Order contains duplicate note ids')
    }

    if (order.length !== current.length) {
      throw badRequest('Order must include all notes in the bucket')
    }

    for (const noteId of order) {
      if (!current.includes(noteId)) {
        throw badRequest(`Note ${noteId} does not belong to bucket ${bucket}`)
      }
    }

    const tx = db.transaction((ids) => {
      ids.forEach((noteId, idx) => {
        updateOrderPositionStmt.run(idx, userId, noteId)
      })
      touchUserStmt.run(userId)
    })

    tx(order)
  }

  return {
    getUserStore,
    createNote,
    updateNote,
    deleteNote,
    reorderBucket,
  }
}
