import { runningModuleStore } from 'sleetcord'
import { LoggerOptions } from 'pino'
import env from 'env-var'
import { prisma } from './db.js'
import { rollbar, baseLogger } from 'sleetcord-common'

const NODE_ENV = env.get('NODE_ENV').required().asString()
const USE_PINO_PRETTY = env.get('USE_PINO_PRETTY').required().asBool()

const loggerOptions: LoggerOptions = {
  level: NODE_ENV === 'development' ? 'debug' : 'info',
}

if (USE_PINO_PRETTY) {
  loggerOptions.transport = {
    target: 'pino-dev',
  }
}

const prismaLogger = baseLogger.child({ module: 'prisma' })

/** Warn if a query took longer than X ms */
const QUERY_TOO_LONG_WARNING = 2_000

prisma.$on('query', (e) => {
  prismaLogger.debug(
    { ...moduleName(), type: 'query', duration: e.duration },
    `${e.query}; (Took ${e.duration}ms)`,
  )

  if (e.duration > QUERY_TOO_LONG_WARNING) {
    const context = {
      ...moduleName(),
      type: 'query-too-long',
      duration: e.duration,
    }
    const message = `${e.query}; (Took too long ${e.duration}ms)`

    prismaLogger.warn(context, message)
    rollbar.warn(context, message)
  }
})

prisma.$on('info', (e) => {
  prismaLogger.info(
    { ...moduleName(), type: 'prisma-info' },
    `${e.message} (Target ${e.target})`,
  )
})

prisma.$on('warn', (e) => {
  prismaLogger.warn(
    { ...moduleName(), type: 'prisma-warn' },
    `${e.message} (Target ${e.target})`,
  )
})

prisma.$on('error', (e) => {
  prismaLogger.error(
    { ...moduleName(), type: 'prisma-error' },
    `${e.message} (Target ${e.target})`,
  )
})

function moduleName(): { name: string } | undefined {
  const module = runningModuleStore.getStore()
  if (module) {
    return { name: module.name }
  }
  return
}
