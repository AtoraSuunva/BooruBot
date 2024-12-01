import { GatewayIntentBits, Options, type RESTOptions } from 'discord.js'
import env from 'env-var'
import { SleetClient, type SleetModuleEventHandlers } from 'sleetcord'
import {
  Sentry,
  getModuleRunner,
  initDBLogging,
  initSentry,
  logging,
  sentryLogger,
} from 'sleetcord-common'
import { booruModules } from './boorubot/index.js'
import { miscModules } from './misc/index.js'
import { prisma } from './util/db.js'

async function main() {
  const TOKEN = env.get('TOKEN').required().asString()
  const APPLICATION_ID = env.get('APPLICATION_ID').required().asString()
  const GIT_COMMIT_SHA = env.get('GIT_COMMIT_SHA').asString() ?? 'development'

  initSentry({
    release: GIT_COMMIT_SHA,
    tracesSampler(samplingContext) {
      const { name } = samplingContext

      if (name.includes(':')) {
        // Transaction names are `${module.name}:${event.name}`
        const [moduleName, eventName] = name.split(':') as [
          string,
          keyof SleetModuleEventHandlers,
        ]

        switch (eventName) {
          case 'raw':
            return 0

          case 'messageCreate':
          case 'messageUpdate':
          case 'userUpdate':
            return 0.01
        }

        switch (moduleName) {
          case 'logging':
          case 'sentryLogger':
            return 0.01
        }

        return 0.2
      }

      return 0.2
    },
  })
  initDBLogging(prisma)

  const sleetClient: SleetClient = new SleetClient({
    sleet: {
      token: TOKEN,
      applicationId: APPLICATION_ID,
      moduleRunner: getModuleRunner(),
    },
    client: {
      rest: {
        makeRequest: fetch as unknown as RESTOptions['makeRequest'],
      },
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
          maxSize: 50,
          keepOverLimit: (member) => member.id === sleetClient.client.user?.id,
        },
        UserManager: {
          maxSize: 50,
          keepOverLimit: (user) => user.id === sleetClient.client.user?.id,
        },
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        // Remove messages older than 30 minutes every 30 minutes
        messages: {
          interval: 1800,
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
    sentryLogger,
  ])

  await sleetClient.putCommands()
  await sleetClient.login()
}

// See https://docs.sentry.io/platforms/node/configuration/integrations/default-integrations/
try {
  await main()
} catch (err) {
  Sentry.captureException(err)
}
