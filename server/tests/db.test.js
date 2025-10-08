import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDatabase, runMigrations, getMigrationsDir, closeDatabase } from '../src/db.js'

const originalDbPath = process.env.DATABASE_PATH

const withTempDatabase = (t, targetPath) => {
  process.env.DATABASE_PATH = targetPath
  const db = createDatabase()
  t.after(() => {
    closeDatabase(db)
    process.env.DATABASE_PATH = originalDbPath
  })
  return db
}

test('createDatabase creates missing directories and honours DATABASE_PATH override', (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-db-root-'))
  const nestedDir = path.join(tmpRoot, 'nested', 'path')
  const dbPath = path.join(nestedDir, 'notes.sqlite')
  const db = withTempDatabase(t, dbPath)

  t.after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  assert.ok(fs.existsSync(nestedDir), 'expected createDatabase to create parent directories')
  assert.ok(fs.existsSync(dbPath), 'expected database file to exist')

  const entries = db.pragma('database_list')
  const main = entries.find((entry) => entry.name === 'main')
  assert.ok(main)
  assert.equal(path.resolve(main.file), path.resolve(dbPath))
})

test('runMigrations applies new files once and records progress', (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-db-migrations-'))
  const dbPath = path.join(tmpRoot, 'notes.sqlite')
  const db = withTempDatabase(t, dbPath)

  const migrationsDir = getMigrationsDir()
  const tempMigration = path.join(migrationsDir, `zzz_temp_${Date.now()}.sql`)
  fs.writeFileSync(tempMigration, 'CREATE TABLE temp_migration_check (id TEXT PRIMARY KEY);')

  t.after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    fs.rmSync(tempMigration, { force: true })
  })

  runMigrations(db)

  const applied = db.prepare('SELECT COUNT(*) AS count FROM migrations WHERE name = ?').get(path.basename(tempMigration))
  assert.equal(applied.count, 1)

  const tableExists = db.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'temp_migration_check'",
  ).get()
  assert.equal(tableExists.count, 1)

  runMigrations(db)
  const reApplied = db.prepare('SELECT COUNT(*) AS count FROM migrations WHERE name = ?').get(path.basename(tempMigration))
  assert.equal(reApplied.count, 1)
})
