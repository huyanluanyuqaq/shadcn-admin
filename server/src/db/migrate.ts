import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { databasePath, db } from './index.js'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(here, '..', '..', 'drizzle')

migrate(db, { migrationsFolder })
console.log(`[db] migrations applied → ${databasePath}`)

process.exit(0)
