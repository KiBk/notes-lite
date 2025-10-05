import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { ZodError } from 'zod'
import { closeDatabase, createDatabase, runMigrations } from './db.js'
import { HttpError, badRequest } from './errors.js'
import { createNoteService } from './note-service.js'

const normalizeUserId = (raw) => {
  const value = (raw ?? '').trim()
  if (!value) {
    throw badRequest('User id is required')
  }
  return value
}

export const createServer = () => {
  const db = createDatabase()
  runMigrations(db)
  const notes = createNoteService(db)

  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))
  app.use(morgan('dev'))

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/api/users/:userId/store', (req, res, next) => {
    try {
      const userId = normalizeUserId(req.params.userId)
      const store = notes.getUserStore(userId)
      res.json(store)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/users/:userId/notes', (req, res, next) => {
    try {
      const userId = normalizeUserId(req.params.userId)
      notes.createNote(userId, req.body ?? {})
      const store = notes.getUserStore(userId)
      res.status(201).json(store)
    } catch (error) {
      next(error)
    }
  })

  app.patch('/api/users/:userId/notes/:noteId', (req, res, next) => {
    try {
      const userId = normalizeUserId(req.params.userId)
      const noteId = (req.params.noteId ?? '').trim()
      if (!noteId) {
        throw badRequest('Note id is required')
      }
      notes.updateNote(userId, noteId, req.body ?? {})
      const store = notes.getUserStore(userId)
      res.json(store)
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/users/:userId/notes/:noteId', (req, res, next) => {
    try {
      const userId = normalizeUserId(req.params.userId)
      const noteId = (req.params.noteId ?? '').trim()
      if (!noteId) {
        throw badRequest('Note id is required')
      }
      notes.deleteNote(userId, noteId)
      const store = notes.getUserStore(userId)
      res.json(store)
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/users/:userId/orders/:bucket', (req, res, next) => {
    try {
      const userId = normalizeUserId(req.params.userId)
      const bucket = (req.params.bucket ?? '').trim()
      if (!bucket) {
        throw badRequest('Bucket is required')
      }
      notes.reorderBucket(userId, bucket, req.body ?? {})
      const store = notes.getUserStore(userId)
      res.json(store)
    } catch (error) {
      next(error)
    }
  })

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found' })
  })

  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        message: 'Validation failed',
        issues: err.issues,
      })
      return
    }

    if (err instanceof HttpError) {
      res.status(err.status).json({
        message: err.message,
        details: err.details,
      })
      return
    }

    console.error('Unexpected error', err)
    res.status(500).json({ message: 'Internal server error' })
  })

  const close = () => {
    closeDatabase(db)
  }

  return { app, close }
}
