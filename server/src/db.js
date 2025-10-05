import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_DB_RELATIVE_PATH = path.join('data', 'notes.db')

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations')

const ensureDirSync = (filePath) => {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const resolveDatabasePath = () => {
  const envPath = process.env.DATABASE_PATH
  if (envPath) {
    return path.resolve(envPath)
  }
  return path.resolve(process.cwd(), DEFAULT_DB_RELATIVE_PATH)
}

export const createDatabase = () => {
  const dbPath = resolveDatabasePath()
  ensureDirSync(dbPath)
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  return db
}

const createMigrationsTable = (db) => {
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

export const runMigrations = (db) => {
  createMigrationsTable(db)
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true })
    return
  }

  const appliedRows = db.prepare('SELECT name FROM migrations').all()
  const applied = new Set(appliedRows.map((row) => row.name))

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  const insertMigration = db.prepare('INSERT INTO migrations (name) VALUES (?)')

  files.forEach((file) => {
    if (applied.has(file)) {
      return
    }
    const fullPath = path.join(MIGRATIONS_DIR, file)
    const sql = fs.readFileSync(fullPath, 'utf8')

    const run = db.transaction(() => {
      db.exec(sql)
      insertMigration.run(file)
    })

    run()
    console.log(`Applied migration: ${file}`)
  })
}

export const closeDatabase = (db) => {
  db?.close?.()
}

export const getMigrationsDir = () => MIGRATIONS_DIR
