import { createServer } from 'node:http'
import type { Client } from 'discord.js'
import env from 'env-var'
import { SleetModule } from 'sleetcord'
import { baseLogger } from 'sleetcord-common'
import { prisma } from '../util/db.js'

export const healthcheck = new SleetModule(
  {
    name: 'healthcheck',
  },
  {
    ready: handleReady,
  },
)

const healthcheckLogger = baseLogger.child({ module: 'init' })

const HEALTHCHECK_PORT = env.get('HEALTHCHECK_PORT').asPortNumber()

async function handleReady(_client: Client<true>) {
  if (!HEALTHCHECK_PORT) return

  // Ensure we have connection to the DB
  await prisma.$queryRaw`SELECT 1`

  const base = `http://localhost:${HEALTHCHECK_PORT}/`

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', base)

    switch (url.pathname) {
      case '/healthcheck':
        res.writeHead(200)
        res.end('OK')
        break

      default:
        res.writeHead(404)
        res.end('Not Found')
    }
  })

  server.listen(HEALTHCHECK_PORT, '0.0.0.0', () => {
    healthcheckLogger.info(`Healthcheck listening on ${base}healthcheck`)
  })
}
