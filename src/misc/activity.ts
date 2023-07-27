import {
  ActivityOptions,
  ActivityType,
  APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Client,
} from 'discord.js'
import { isOwnerGuard, SleetContext, SleetSlashCommand } from 'sleetcord'
import { MINUTE } from '../util/constants.js'
import { readFile } from 'fs/promises'
import env from 'env-var'

/** Our activity list needs a type and name to apply */
type Activity = Required<Pick<ActivityOptions, 'name' | 'type'>>

/**
 * Valid choices for activities that bots can set
 */
const activityChoices: APIApplicationCommandOptionChoice<number>[] = [
  {
    name: 'playing',
    value: ActivityType.Playing,
  },
  {
    name: 'streaming',
    value: ActivityType.Streaming,
  },
  {
    name: 'listening',
    value: ActivityType.Listening,
  },
  {
    name: 'watching',
    value: ActivityType.Watching,
  },
  {
    name: 'competing',
    value: ActivityType.Competing,
  },
]

/**
 * Set the activity that a bot is doing, ie. the "**Playing** some game"
 */
export const activity = new SleetSlashCommand(
  {
    name: 'activity',
    description: 'Allow to randomly/manually set a new activity',
    options: [
      {
        name: 'name',
        type: ApplicationCommandOptionType.String,
        description: 'The new activity name to use',
      },
      {
        name: 'type',
        type: ApplicationCommandOptionType.Integer,
        description: 'The activity type to set',
        choices: activityChoices,
      },
    ],
    registerOnlyInGuilds: [],
  },
  {
    ready: runReady,
    run: runActivity,
  },
)

/** Holds the timeout that we use to periodically change the activity */
let timeout: NodeJS.Timeout
/** Every 15m, change the current activity */
const timeoutDelay = 15 * MINUTE // in ms
/** These activities will be randomly selected and shown by the bot */
const activities: Activity[] = []

const ACTIVITIES_FILE = env.get('ACTIVITIES_FILE').asString()

async function loadActivities() {
  if (!ACTIVITIES_FILE) return

  const lines = await readFile(ACTIVITIES_FILE, 'utf-8').then((content) =>
    content.trim().split('\n'),
  )

  const stats: Activity[] = lines.map((line) => {
    const space = line.indexOf(' ') + 1
    let [type, name] = [line.substring(0, space), line.substring(space)].map(
      (str) => str.trim(),
    )

    type = type.replace(/{(\w+)}/, '$1')

    if (!(type in ActivityType)) {
      type = 'Playing'
      name = line
    }

    let actType = ActivityType[type as keyof typeof ActivityType]

    if (actType === ActivityType.Custom) {
      actType = ActivityType.Playing
    }

    return {
      type: actType,
      name,
    }
  })

  activities.push(...stats)
}

/** Run a timeout to change the bot's activity on READY and every couple mins */
async function runReady(client: Client) {
  await loadActivities()
  const activity = getRandomActivity()
  client.user?.setActivity(activity)
  timeout = setTimeout(() => {
    void runReady(client)
  }, timeoutDelay)
}

/** Either set a new random activity, or set it to the one the user specified */
async function runActivity(
  this: SleetContext,
  interaction: ChatInputCommandInteraction,
) {
  await isOwnerGuard(interaction)

  const name = interaction.options.getString('name')
  const type = interaction.options.getInteger('type') as Exclude<
    ActivityOptions['type'],
    undefined
  > | null

  let activity: Activity
  clearTimeout(timeout)

  if (type === null && name === null) {
    // Set a random one
    activity = getRandomActivity()
    timeout = setTimeout(() => {
      void runReady(interaction.client)
    }, timeoutDelay)
  } else {
    const previousActivity = interaction.client.user.presence.activities[0]
    activity = {
      type:
        type ??
        (previousActivity.type as Exclude<ActivityType, ActivityType.Custom>),
      name: name ?? previousActivity.name,
    }
  }

  interaction.client.user.setActivity(activity)
  return interaction.reply({
    ephemeral: true,
    content: `Set activity to:\n> ${formatActivity(activity)}`,
  })
}

/** You shouldn't see this, this is just a fallback activity if the random pick fails */
const FALLBACK_ACTIVITY: Activity = {
  type: ActivityType.Playing,
  name: 'failed to load activity!',
} as const

/**
 * Get a random activity from our list of activities
 * @returns a random activity from the list
 */
function getRandomActivity(): Activity {
  const randomIndex = Math.floor(Math.random() * activities.length)
  return activities[randomIndex] ?? FALLBACK_ACTIVITY
}

/** Maps from an activity ID or string to a display string */
const reverseActivityTypesMap: Record<
  Exclude<Activity['type'], undefined>,
  string
> = {
  [ActivityType.Playing]: 'Playing',
  [ActivityType.Streaming]: 'Streaming',
  [ActivityType.Listening]: 'Listening to',
  [ActivityType.Watching]: 'Watching',
  [ActivityType.Competing]: 'Competing in',
}

/**
 * Formats an activity object into a string
 * @param activity The activity object
 * @returns The formatted string
 */
function formatActivity(activity: Activity): string {
  const activityType = reverseActivityTypesMap[activity.type]
  const formattedType = activityType ? `**${activityType}** ` : ''
  return `${formattedType}${activity.name}`
}
