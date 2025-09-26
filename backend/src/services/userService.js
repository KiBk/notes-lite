const db = require('../db');

function normalizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim();
}

async function upsertUser(rawName) {
  const name = normalizeName(rawName);
  if (!name) {
    const error = new Error('Name is required');
    error.status = 400;
    throw error;
  }

  const result = await db.query(
    `INSERT INTO users (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name;`,
    [name]
  );
  return result.rows[0];
}

async function findUserById(id) {
  const result = await db.query('SELECT id, name FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = {
  upsertUser,
  findUserById,
};
