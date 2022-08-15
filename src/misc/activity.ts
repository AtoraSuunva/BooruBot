import {
  ActivityOptions,
  ActivityType,
  APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Client,
} from 'discord.js'
import { isOwner, SleetContext, SleetSlashCommand } from 'sleetcord'

/** Our status list needs a type and name to apply */
type Status = Pick<ActivityOptions, 'name' | 'type'>

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
  },
  {
    ready: runReady,
    run: runActivity,
  },
)

/** These statuses will be randomly selected and shown by the bot */
const statuses: Status[] = [
  { type: ActivityType.Playing, name: 'with boorus!' },
  { type: ActivityType.Streaming, name: 'christian anime!' },
  { type: ActivityType.Playing, name: 'send nudes' },
  { type: ActivityType.Playing, name: 'as a glaceon irl' },
  { type: ActivityType.Streaming, name: 'handholding' },
  { type: ActivityType.Streaming, name: 'pawholding' },
  { type: ActivityType.Streaming, name: 'some furry stuff' },
  { type: ActivityType.Playing, name: 'alone' },
  { type: ActivityType.Playing, name: 'with Atlas!' },
  { type: ActivityType.Playing, name: 'with RobotOtter!' },
  { type: ActivityType.Playing, name: 'with BulbaTrivia!' },
  { type: ActivityType.Playing, name: "with Haram--wait he's dead" },
  { type: ActivityType.Playing, name: 'with Tol Bot 💙' },
  { type: ActivityType.Playing, name: 'with Scops!' },
  { type: ActivityType.Playing, name: 'with Napstato--oh, right' },
  { type: ActivityType.Playing, name: 'gaming simulator 2022' },
  { type: ActivityType.Playing, name: 'aaa' },
  { type: ActivityType.Playing, name: 'with shit code.' },
  { type: ActivityType.Streaming, name: 'the entire bee movie' },
  { type: ActivityType.Streaming, name: 'memes.' },
  { type: ActivityType.Streaming, name: 'Atlas Dying.' },
  { type: ActivityType.Playing, name: 'Japanese Anime Schoolgirl Sim' },
  { type: ActivityType.Playing, name: 'nya' },
  { type: ActivityType.Playing, name: 'as a flareon' },
  { type: ActivityType.Streaming, name: 'Jolt hugs!' },
  { type: ActivityType.Streaming, name: 'the Twitch logout page.' },
  { type: ActivityType.Streaming, name: 'Playing' },
  { type: ActivityType.Playing, name: 'Streaming' },
  { type: ActivityType.Playing, name: 'send dudes' },
  { type: ActivityType.Streaming, name: 'Atlas crying while debugging' },
  { type: ActivityType.Watching, name: 'atlas cry' },
  { type: ActivityType.Watching, name: 'the eevees!' },
  { type: ActivityType.Listening, name: 'the screams of the damned' },
  { type: ActivityType.Watching, name: 'probably something dumb' },
  { type: ActivityType.Watching, name: 'RobotOtter and Bulba fight' },
  { type: ActivityType.Listening, name: 'the moans of the damned' },
  { type: ActivityType.Playing, name: 'kobold' },
  { type: ActivityType.Watching, name: 'girls.. , .,' },
  { type: ActivityType.Watching, name: 'for big tiddy dragon gf' },
  { type: ActivityType.Playing, name: 'funny joke' },
  { type: ActivityType.Competing, name: 'competitive shitposting' },
  { type: ActivityType.Competing, name: 'the battle tower' },
  { type: ActivityType.Competing, name: 'a pokemon battle!' },
  { type: ActivityType.Competing, name: 'casual shitposting' },
  { type: ActivityType.Competing, name: 'a fight to the death' },
  { type: ActivityType.Competing, name: 'violence' },
]

/** Holds the timeout that we use to periodically change the status */
let timeout: NodeJS.Timeout
/** Every 15m, change the current status */
const timeoutDelay = 15 * 60 * 1000 // in ms

/** Run a timeout to change the bot's status on READY and every couple mins */
async function runReady(client: Client) {
  const status = getRandomStatus()
  client.user?.setActivity(status)
  timeout = setTimeout(() => runReady(client), timeoutDelay)
}

/** Either set a new random status, or set it to the one the user specified */
async function runActivity(
  this: SleetContext,
  interaction: ChatInputCommandInteraction,
) {
  isOwner(interaction)

  if (!interaction.client.user) {
    return interaction.reply({
      ephemeral: true,
      content: 'The client user is not ready or available!',
    })
  }

  const name = interaction.options.getString('name')
  const type = interaction.options.getInteger('type') as Exclude<
    ActivityOptions['type'],
    undefined
  >

  let activity: Status
  clearTimeout(timeout)

  if (type === null && name === null) {
    // Set a random one
    activity = getRandomStatus()
    timeout = setTimeout(() => runReady(interaction.client), timeoutDelay)
  } else {
    const act: ActivityOptions = {}

    if (name !== null) act.name = name
    if (type !== null) act.type = type

    activity = act
  }

  interaction.client.user.setActivity(activity)
  return interaction.reply({
    ephemeral: true,
    content: `Set activity to:\n> ${formatStatus(activity)}`,
  })
}

/** You shouldn't see this, this is just a fallback status if the random pick fails */
const FALLBACK_STATUS: Status = {
  type: ActivityType.Playing,
  name: 'an error happened!!',
} as const

/**
 * Get a random status from our list of statuses
 * @returns a random status from the list
 */
function getRandomStatus(): Status {
  const randomIndex = Math.floor(Math.random() * statuses.length)
  return statuses[randomIndex] ?? FALLBACK_STATUS
}

/** Maps from an activity ID or string to a display string */
const reverseActivityTypesMap: Record<
  Exclude<Status['type'], undefined>,
  string
> = {
  [ActivityType.Playing]: 'Playing',
  [ActivityType.Streaming]: 'Streaming',
  [ActivityType.Listening]: 'Listening to',
  [ActivityType.Watching]: 'Watching',
  [ActivityType.Competing]: 'Competing in',
}

/**
 * Formats a status object into a string
 * @param status The status object
 * @returns The formatted string
 */
function formatStatus(status: Status): string {
  const activityType = reverseActivityTypesMap[status.type ?? 0]
  const activity = activityType ? `**${activityType}** ` : ''
  return `${activity}${status.name}`
}
