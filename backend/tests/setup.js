process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/noteslite_test';

const db = require('../src/db');

beforeAll(async () => {
  await db.migrate();
});

beforeEach(async () => {
  await db.query('TRUNCATE TABLE notes RESTART IDENTITY CASCADE;');
  await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
});

afterAll(async () => {
  await db.pool.end();
});
