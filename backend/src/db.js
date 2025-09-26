const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/noteslite';

const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  console.error('Unexpected database error', err);
  process.exit(-1);
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      pinned_order INTEGER,
      unpinned_order INTEGER,
      archived_order INTEGER,
      color TEXT NOT NULL DEFAULT '#f8fafc',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(
    "ALTER TABLE notes ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#f8fafc'"
  );

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_notes_user_archived ON notes(user_id, archived)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, pinned)'
  );
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  migrate,
};
