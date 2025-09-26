const db = require('../db');

function mapDbNote(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    archived: row.archived,
    pinnedOrder: row.pinned_order,
    unpinnedOrder: row.unpinned_order,
    archivedOrder: row.archived_order,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getNextOrder(client, userId, column, extraConditions = '') {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(${column}), -1) + 1 AS next
     FROM notes
     WHERE user_id = $1 ${extraConditions}`,
    [userId]
  );
  return rows[0].next;
}

async function createNote({ userId, title = '', body = '', color }) {
  if (!userId) {
    const error = new Error('userId is required');
    error.status = 400;
    throw error;
  }
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const safeBody = typeof body === 'string' ? body : '';
  const safeColor = typeof color === 'string' && color.trim().length ? color.trim() : '#f8fafc';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const nextOrder = await getNextOrder(
      client,
      userId,
      'unpinned_order',
      'AND archived = FALSE AND pinned = FALSE'
    );

    const { rows } = await client.query(
      `INSERT INTO notes (user_id, title, body, pinned, archived, unpinned_order, color)
       VALUES ($1, $2, $3, FALSE, FALSE, $4, $5)
       RETURNING *;`,
      [userId, trimmedTitle, safeBody, nextOrder, safeColor]
    );
    await client.query('COMMIT');
    return mapDbNote(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getNotes({ userId, search }) {
  if (!userId) {
    const error = new Error('userId is required');
    error.status = 400;
    throw error;
  }

  const params = [userId];
  let searchSql = '';
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    searchSql = 'AND (title ILIKE $2 OR body ILIKE $2)';
  }

  const { rows } = await db.query(
    `SELECT * FROM notes
     WHERE user_id = $1 ${searchSql}
     ORDER BY archived ASC, pinned DESC, pinned_order NULLS LAST, unpinned_order NULLS LAST, archived_order NULLS LAST, id ASC;`,
    params
  );

  const result = {
    pinned: [],
    unpinned: [],
    archived: [],
  };

  rows.forEach((row) => {
    const note = mapDbNote(row);
    if (note.archived) {
      result.archived.push(note);
    } else if (note.pinned) {
      result.pinned.push(note);
    } else {
      result.unpinned.push(note);
    }
  });

  return result;
}

async function findNoteOwnedByUser(client, userId, noteId) {
  const { rows } = await client.query(
    'SELECT * FROM notes WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [noteId, userId]
  );
  return rows[0];
}

async function updateNote({ userId, noteId, updates }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await findNoteOwnedByUser(client, userId, noteId);
    if (!existing) {
      const error = new Error('Note not found');
      error.status = 404;
      throw error;
    }

    const nextValues = {
      title:
        Object.prototype.hasOwnProperty.call(updates, 'title') &&
        typeof updates.title === 'string'
          ? updates.title.trim()
          : existing.title,
      body:
        Object.prototype.hasOwnProperty.call(updates, 'body') &&
        typeof updates.body === 'string'
          ? updates.body
          : existing.body,
      pinned:
        Object.prototype.hasOwnProperty.call(updates, 'pinned')
          ? Boolean(updates.pinned)
          : existing.pinned,
      archived:
        Object.prototype.hasOwnProperty.call(updates, 'archived')
          ? Boolean(updates.archived)
          : existing.archived,
      color:
        Object.prototype.hasOwnProperty.call(updates, 'color') &&
        typeof updates.color === 'string'
          ? updates.color.trim() || existing.color
          : existing.color,
    };

    let pinnedOrder = existing.pinned_order;
    let unpinnedOrder = existing.unpinned_order;
    let archivedOrder = existing.archived_order;

    if (existing.archived && !nextValues.archived) {
      archivedOrder = null;
      if (nextValues.pinned) {
        pinnedOrder = await getNextOrder(
          client,
          userId,
          'pinned_order',
          'AND archived = FALSE AND pinned = TRUE'
        );
        unpinnedOrder = null;
      } else {
        unpinnedOrder = await getNextOrder(
          client,
          userId,
          'unpinned_order',
          'AND archived = FALSE AND pinned = FALSE'
        );
        pinnedOrder = null;
      }
    } else if (!existing.archived && nextValues.archived) {
      archivedOrder = await getNextOrder(
        client,
        userId,
        'archived_order',
        'AND archived = TRUE'
      );
      pinnedOrder = null;
      unpinnedOrder = null;
    } else if (!nextValues.archived && existing.pinned !== nextValues.pinned) {
      if (nextValues.pinned) {
        pinnedOrder = await getNextOrder(
          client,
          userId,
          'pinned_order',
          'AND archived = FALSE AND pinned = TRUE'
        );
        unpinnedOrder = null;
      } else {
        unpinnedOrder = await getNextOrder(
          client,
          userId,
          'unpinned_order',
          'AND archived = FALSE AND pinned = FALSE'
        );
        pinnedOrder = null;
      }
    }

    if (nextValues.archived) {
      archivedOrder =
        archivedOrder !== null && archivedOrder !== undefined
          ? archivedOrder
          : await getNextOrder(client, userId, 'archived_order', 'AND archived = TRUE');
    }

    const setFragments = [];
    const params = [];
    let index = 1;

    if (nextValues.title !== existing.title) {
      setFragments.push(`title = $${index++}`);
      params.push(nextValues.title);
    }
    if (nextValues.body !== existing.body) {
      setFragments.push(`body = $${index++}`);
      params.push(nextValues.body);
    }
    if (nextValues.pinned !== existing.pinned) {
      setFragments.push(`pinned = $${index++}`);
      params.push(nextValues.pinned);
    }
    if (nextValues.archived !== existing.archived) {
      setFragments.push(`archived = $${index++}`);
      params.push(nextValues.archived);
    }

    if (nextValues.color !== existing.color) {
      setFragments.push(`color = $${index++}`);
      params.push(nextValues.color);
    }

    if (pinnedOrder !== existing.pinned_order) {
      if (pinnedOrder === null || pinnedOrder === undefined) {
        setFragments.push(`pinned_order = NULL`);
      } else {
        setFragments.push(`pinned_order = $${index++}`);
        params.push(pinnedOrder);
      }
    }

    if (unpinnedOrder !== existing.unpinned_order) {
      if (unpinnedOrder === null || unpinnedOrder === undefined) {
        setFragments.push(`unpinned_order = NULL`);
      } else {
        setFragments.push(`unpinned_order = $${index++}`);
        params.push(unpinnedOrder);
      }
    }

    if (archivedOrder !== existing.archived_order) {
      if (archivedOrder === null || archivedOrder === undefined) {
        setFragments.push(`archived_order = NULL`);
      } else {
        setFragments.push(`archived_order = $${index++}`);
        params.push(archivedOrder);
      }
    }

    if (!setFragments.length) {
      await client.query('ROLLBACK');
      return mapDbNote(existing);
    }

    setFragments.push('updated_at = NOW()');

    params.push(noteId, userId);

    const { rows } = await client.query(
      `UPDATE notes SET ${setFragments.join(', ')} WHERE id = $${index++} AND user_id = $${index}
       RETURNING *;`,
      params
    );

    await client.query('COMMIT');
    return mapDbNote(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteNote({ userId, noteId }) {
  const { rows } = await db.query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *;',
    [noteId, userId]
  );
  if (!rows.length) {
    const error = new Error('Note not found');
    error.status = 404;
    throw error;
  }
  return mapDbNote(rows[0]);
}

const toIdArray = (items = []) =>
  items
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

async function reorderNotes({ userId, pinnedIds = [], unpinnedIds = [], archivedIds = [] }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const pinnedList = toIdArray(pinnedIds);
    const unpinnedList = toIdArray(unpinnedIds);
    const archivedList = toIdArray(archivedIds);

    for (let i = 0; i < pinnedList.length; i += 1) {
      await client.query(
        `UPDATE notes SET pinned_order = $1, unpinned_order = NULL, updated_at = NOW()
         WHERE id = $2 AND user_id = $3 AND archived = FALSE;`,
        [i, pinnedList[i], userId]
      );
    }

    for (let i = 0; i < unpinnedList.length; i += 1) {
      await client.query(
        `UPDATE notes SET unpinned_order = $1, pinned_order = NULL, updated_at = NOW()
         WHERE id = $2 AND user_id = $3 AND archived = FALSE;`,
        [i, unpinnedList[i], userId]
      );
    }

    for (let i = 0; i < archivedList.length; i += 1) {
      await client.query(
        `UPDATE notes SET archived_order = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3 AND archived = TRUE;`,
        [i, archivedList[i], userId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const reordered = await getNotes({ userId });
  return reordered;
}

module.exports = {
  createNote,
  getNotes,
  updateNote,
  deleteNote,
  reorderNotes,
};
