import env from 'env-var'
import { HOUR } from 'sleetcord-common'
import { PrismaClient } from '../generated/prisma/client.js'

const NODE_ENV = env.get('NODE_ENV').required().asString()

export const prisma: PrismaClient = new PrismaClient({
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

// _activeProvider isn't documented, but our auto stuff is only designed for sqlite
if ('_activeProvider' in prisma && prisma._activeProvider === 'sqlite') {
  // https://www.sqlite.org/wal.html
  // For speed
  await prisma.$queryRaw`PRAGMA journal_mode=WAL`
  // https://litestream.io/tips/#busy-timeout
  await prisma.$queryRaw`PRAGMA busy_timeout = 5000;`
  setInterval(() => void analyzeDatabase(), 12 * HOUR)
}
