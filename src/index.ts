import { GatewayIntentBits, Options } from 'discord.js'
import env from 'env-var'
import { SleetClient } from 'sleetcord'
import { LoggerOptions } from 'pino'
import { activity } from './misc/activity.js'
import { info } from './misc/info.js'
import { stats } from './misc/stats.js'
import { autoreply } from './misc/autoreply.js'
import { ping } from './misc/ping.js'
import { blacklist } from './boorubot/blacklist/index.js'
import { config } from './boorubot/config/index.js'
import { search } from './boorubot/search/search.js'
import { link } from './boorubot/link.js'
import { view } from './boorubot/view/index.js'
import { rollbarLogger } from './util/rollbar.js'

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

const sleetClient: SleetClient = new SleetClient({
  sleet: {
    token: TOKEN,
    applicationId: APPLICATION_ID,
  },
  client: {
    shards: 'auto',
    intents: [
      // Remove this once people are better aware of slash commands?
      // I should monitor @bot mentions to see if they die out
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.Guilds,
    ],
    // We only care about a few things, so we can just not cache most things to save memory
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      ReactionManager: 0,
      BaseGuildEmojiManager: 0,
      GuildEmojiManager: 0,
      GuildBanManager: 0,
      GuildStickerManager: 0,
      GuildInviteManager: 0,
      GuildScheduledEventManager: 0,
      PresenceManager: 0,
      VoiceStateManager: 0,
      ReactionUserManager: 0,
      StageInstanceManager: 0,
      ThreadMemberManager: 0,
      GuildMemberManager: {
        maxSize: 200,
        keepOverLimit: (member) => member.id === sleetClient.client.user?.id,
      },
      UserManager: {
        maxSize: 200,
        keepOverLimit: (user) => user.id === sleetClient.client.user?.id,
      },
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      // Remove messages older than 30 minutes every hour
      messages: {
        interval: 3600,
        lifetime: 1800,
      },
      // Remove all bots every hour
      users: {
        interval: 3600,
        filter: () => (user) =>
          user.bot && user.id !== sleetClient.client.user?.id,
      },
    },
  },
  logger: loggerOptions,
})

sleetClient.addModules([
  // booru
  blacklist,
  config,
  search,
  link,
  view,

  // misc
  activity,
  autoreply,
  info,
  ping,
  stats,

  // error logging
  rollbarLogger,
])

sleetClient.putCommands()
sleetClient.login()
