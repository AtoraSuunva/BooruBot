import { GatewayIntentBits } from 'discord.js'
import env from 'env-var'
import { SleetClient } from 'sleetcord'
import { LoggerOptions } from 'pino'
import { activity } from './misc/activity.js'
import { info } from './misc/info.js'
import { stats } from './misc/stats.js'
import { autoreply } from './misc/autoreply.js'
import { ping } from './misc/ping.js'
import { blacklist } from './boorubot/blacklist/index.js'

const TOKEN = env.get('TOKEN').required().asString()
const APPLICATION_ID = env.get('APPLICATION_ID').required().asString()
const NODE_ENV = env.get('NODE_ENV').required().asString()
const USE_PINO_PRETTY = env.get('USE_PINO_PRETTY').required().asBool()

const loggerOptions: LoggerOptions = {
  level: NODE_ENV === 'development' ? 'debug' : 'info',
}

if (USE_PINO_PRETTY) {
  loggerOptions.transport = {
    target: 'pino-pretty',
  }
}

const sleetClient = new SleetClient({
  sleet: {
    token: TOKEN,
    applicationId: APPLICATION_ID,
  },
  client: {
    intents: [GatewayIntentBits.Guilds],
  },
  logger: loggerOptions,
})

sleetClient.addModules([
  // booru
  blacklist,
  // misc
  activity,
  autoreply,
  info,
  ping,
  stats,
])

// const TEST_GUILD_ID = env.get('TEST_GUILD_ID').required().asString()
// sleetClient.putCommands({ guildId: TEST_GUILD_ID, commands: [] })

sleetClient.putCommands()
sleetClient.login()
