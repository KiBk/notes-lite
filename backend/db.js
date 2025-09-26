const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error", error);
});

function mapRowToNote(row) {
  const createdAt = row.createdAt == null ? null : Math.round(Number(row.createdAt));
  const updatedAt = row.updatedAt == null ? null : Math.round(Number(row.updatedAt));
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt,
    updatedAt,
    archived: Boolean(row.archived),
    position: typeof row.position === "number" ? row.position : Number(row.position || 0),
  };
}

async function ensureUser(username, displayName = null) {
  await pool.query(
    `INSERT INTO users (username, display_name)
     VALUES ($1, $2)
     ON CONFLICT (username)
     DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)`,
    [username, displayName]
  );
}

async function listNotes(username, options = {}) {
  const { archived } = options;
  const params = [username];
  let query = `SELECT id,
                      title,
                      body,
                      archived,
                      position,
                      EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                      EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
                 FROM notes
                WHERE username = $1`;

  if (typeof archived === "boolean") {
    params.push(archived);
    query += ` AND archived = $${params.length}`;
  }

  query += " ORDER BY archived ASC, position ASC, updated_at DESC, created_at DESC";

  const result = await pool.query(query, params);
  return result.rows.map(mapRowToNote);
}

async function searchNotes(username, query) {
  const term = `%${query}%`;
  const result = await pool.query(
    `SELECT id,
            title,
            body,
            archived,
            position,
            EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
            EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
       FROM notes
      WHERE username = $1
        AND (title ILIKE $2 OR body ILIKE $2)
      ORDER BY archived ASC, position ASC, updated_at DESC, created_at DESC`,
    [username, term]
  );
  return result.rows.map(mapRowToNote);
}

async function nextPosition(username, archived) {
  const result = await pool.query(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next
       FROM notes
      WHERE username = $1 AND archived = $2`,
    [username, archived]
  );
  return Number(result.rows[0]?.next || 1);
}

async function createNote({ id, username, title, body }) {
  const position = await nextPosition(username, false);
  const result = await pool.query(
    `INSERT INTO notes (id, username, title, body, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id,
               title,
               body,
               archived,
               position,
               EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
               EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"`,
    [id, username, title, body, position]
  );
  return mapRowToNote(result.rows[0]);
}

async function updateNote({ id, username, title, body }) {
  const result = await pool.query(
    `UPDATE notes
        SET title = $1,
            body = $2,
            updated_at = NOW()
      WHERE id = $3
        AND username = $4
      RETURNING id,
                title,
                body,
                archived,
                position,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"`,
    [title, body, id, username]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRowToNote(result.rows[0]);
}

async function archiveNote({ id, username }) {
  const position = await nextPosition(username, true);
  const result = await pool.query(
    `UPDATE notes
        SET archived = TRUE,
            position = $3,
            updated_at = NOW()
      WHERE id = $1
        AND username = $2
        AND archived = FALSE
      RETURNING id,
                title,
                body,
                archived,
                position,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"`,
    [id, username, position]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRowToNote(result.rows[0]);
}

async function getNote({ id, username }) {
  const result = await pool.query(
    `SELECT id,
            title,
            body,
            archived,
            position,
            EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
            EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
       FROM notes
      WHERE id = $1 AND username = $2`,
    [id, username]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRowToNote(result.rows[0]);
}

async function unarchiveNote({ id, username }) {
  const position = await nextPosition(username, false);
  const result = await pool.query(
    `UPDATE notes
        SET archived = FALSE,
            position = $3,
            updated_at = NOW()
      WHERE id = $1
        AND username = $2
        AND archived = TRUE
      RETURNING id,
                title,
                body,
                archived,
                position,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"`,
    [id, username, position]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRowToNote(result.rows[0]);
}

async function deleteNote({ id, username }) {
  const result = await pool.query(
    `DELETE FROM notes WHERE id = $1 AND username = $2`,
    [id, username]
  );
  return result.rowCount > 0;
}

async function reorderNotes({ username, ids, archived }) {
  if (!Array.isArray(ids) || !ids.length) {
    return [];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let position = 1;
    for (const id of ids) {
      await client.query(
        `UPDATE notes
            SET position = $1,
                updated_at = NOW()
          WHERE id = $2 AND username = $3 AND archived = $4`,
        [position, id, username, archived]
      );
      position += 1;
    }

    const result = await client.query(
      `SELECT id,
              title,
              body,
              archived,
              position,
              EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
              EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
         FROM notes
        WHERE username = $1 AND archived = $2
        ORDER BY position ASC, updated_at DESC`,
      [username, archived]
    );

    await client.query("COMMIT");
    return result.rows.map(mapRowToNote);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureUser,
  listNotes,
  searchNotes,
  createNote,
  updateNote,
  archiveNote,
  getNote,
  unarchiveNote,
  deleteNote,
  reorderNotes,
};
