import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3'
import env from 'env-var'
import { HOUR } from 'sleetcord-common'
import { PrismaClient } from '../generated/prisma/client.js'

const NODE_ENV = env.get('NODE_ENV').required().asString()
const DATABASE_URL = env.get('DATABASE_URL').required().asString()

// DATABASE_URL will be something like "file:./db/dev.db" (required by prisma CLI)
// We need to transform it to "file:./prisma/db/dev.db" (required by better-sqlite3)
const dbPath = DATABASE_URL.split('file:')[1]
const dbPathParts = dbPath.split('/')

if (!dbPath.startsWith('./prisma')) {
  // If the path doesn't start with ./prisma, we need to add it
  dbPathParts.splice(1, 0, 'prisma')
}

const adapter = new PrismaBetterSQLite3({
  url: `file:${dbPathParts.join('/')}`,
  timeout: 5000,
})

export const prisma = new PrismaClient({
  // adapter,
  errorFormat: NODE_ENV === 'development' ? 'pretty' : 'colorless',
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
    {
      emit: 'event',
      level: 'error',
    },
  ],
})

async function analyzeDatabase() {
  // https://www.sqlite.org/lang_vacuum.html
  // This should probably *only* happen when actual large changes are made, but every couple hours shouldn't hurt
  // Maybe, though there's also the question of detecting when large things happen (or providing some way to manually trigger it)
  // But this is an sqlite-specific thing, so the rest of the bot shouldn't be tied to it
  await prisma.$queryRaw`VACUUM`
  // https://www.sqlite.org/lang_analyze.html
  // Maybe add `PRAGMA analysis_limit = 400;` to limit the amount of time it takes? Watch for magic CPU spikes
  await prisma.$queryRaw`PRAGMA optimize`
}

if (adapter.provider === 'sqlite') {
  // https://www.sqlite.org/wal.html
  // For speed
  await prisma.$queryRaw`PRAGMA journal_mode=WAL`
  setInterval(() => void analyzeDatabase(), 12 * HOUR)
}
