import { GatewayIntentBits, Options } from 'discord.js'
import env from 'env-var'
import { SleetClient } from 'sleetcord'
import { logging, rollbarLogger } from 'sleetcord-common'
import { booruModules } from './boorubot/index.js'
import { miscModules } from './misc/index.js'
import './util/dbLogging.js'

const TOKEN = env.get('TOKEN').required().asString()
const APPLICATION_ID = env.get('APPLICATION_ID').required().asString()

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
      AutoModerationRuleManager: 0,
      GuildForumThreadManager: {
        maxSize: 50,
      },
      GuildTextThreadManager: {
        maxSize: 50,
      },
      ThreadManager: {
        maxSize: 50,
      },
      MessageManager: {
        maxSize: 0,
        keepOverLimit: (message) =>
          message.author.id === sleetClient.client.user?.id,
      },
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
      // Remove all bots every 15 minutes
      users: {
        interval: 900,
        filter: () => (user) =>
          user.bot && user.id !== sleetClient.client.user?.id,
      },
    },
  },
})

sleetClient.addModules([
  ...booruModules,
  ...miscModules,
  logging,
  rollbarLogger,
])

await sleetClient.putCommands()
await sleetClient.login()
