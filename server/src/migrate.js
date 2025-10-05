import { closeDatabase, createDatabase, runMigrations } from './db.js'

try {
  const db = createDatabase()
  runMigrations(db)
  closeDatabase(db)
  console.log('Migrations applied successfully')
} catch (error) {
  console.error('Migration failed')
  console.error(error)
  process.exit(1)
}
