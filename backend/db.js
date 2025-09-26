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
                      EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                      EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
                 FROM notes
                WHERE username = $1`;

  if (typeof archived === "boolean") {
    params.push(archived);
    query += ` AND archived = $${params.length}`;
  }

  query += " ORDER BY updated_at DESC, created_at DESC";

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
            EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
            EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
       FROM notes
      WHERE username = $1
        AND (title ILIKE $2 OR body ILIKE $2)
      ORDER BY archived ASC, updated_at DESC, created_at DESC`,
    [username, term]
  );
  return result.rows.map(mapRowToNote);
}

async function createNote({ id, username, title, body }) {
  const result = await pool.query(
    `INSERT INTO notes (id, username, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               title,
               body,
               archived,
               EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
               EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"`,
    [id, username, title, body]
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
  const result = await pool.query(
    `UPDATE notes
        SET archived = TRUE,
            updated_at = NOW()
      WHERE id = $1
        AND username = $2
        AND archived = FALSE
      RETURNING id,
                title,
                body,
                archived,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"`,
    [id, username]
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

async function deleteNote({ id, username }) {
  const result = await pool.query(
    `DELETE FROM notes WHERE id = $1 AND username = $2`,
    [id, username]
  );
  return result.rowCount > 0;
}

module.exports = {
  ensureUser,
  listNotes,
  searchNotes,
  createNote,
  updateNote,
  archiveNote,
  getNote,
  deleteNote,
};
