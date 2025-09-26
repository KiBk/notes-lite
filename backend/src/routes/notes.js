const express = require('express');
const notesService = require('../services/notesService');

const router = express.Router();

function parseUserId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Valid userId is required');
    error.status = 400;
    throw error;
  }
  return id;
}

router.get('/', async (req, res, next) => {
  try {
    const userId = parseUserId(req.query.userId);
    const search = req.query.search;
    const notes = await notesService.getNotes({ userId, search });
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { userId: rawUserId, title, body, color } = req.body || {};
    const userId = parseUserId(rawUserId);
    const note = await notesService.createNote({ userId, title, body, color });
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { userId: rawUserId, ...updates } = req.body || {};
    const userId = parseUserId(rawUserId);
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      const error = new Error('Valid note id is required');
      error.status = 400;
      throw error;
    }
    const note = await notesService.updateNote({ userId, noteId, updates });
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = parseUserId(req.query.userId);
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      const error = new Error('Valid note id is required');
      error.status = 400;
      throw error;
    }
    const note = await notesService.deleteNote({ userId, noteId });
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

router.post('/reorder', async (req, res, next) => {
  try {
    const { userId: rawUserId, pinnedIds, unpinnedIds, archivedIds } = req.body || {};
    const userId = parseUserId(rawUserId);
    const notes = await notesService.reorderNotes({
      userId,
      pinnedIds: Array.isArray(pinnedIds) ? pinnedIds : [],
      unpinnedIds: Array.isArray(unpinnedIds) ? unpinnedIds : [],
      archivedIds: Array.isArray(archivedIds) ? archivedIds : [],
    });
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
