import {
  Client,
  Guild,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashCommand, SleetContext } from 'sleetcord'

/**
 * Get some stats about the bot, for now this includes:
 *   - Guild count
 *   - Members count
 *   - Users cached
 *   - Channels
 *   - Emojis cached
 *   - Sleet modules loaded
 *   - Uptime of the bot
 *   - Creation time of the bot
 */
export const stats = new SleetSlashCommand(
  {
    name: 'stats',
    description: 'Get some stats about the bot',
  },
  {
    run: runStats,
  },
)

/** Get the stats and display them */
async function runStats(
  this: SleetContext,
  interaction: ChatInputCommandInteraction,
) {
  const { client } = interaction

  /** The helper funcs work for both sharded and unsharded bots */
  const [guildCount, memberCount, userCount, channelCount, emojis] =
    await Promise.all([
      getGuildCount(client),
      getMemberCount(client),
      getUserCount(client),
      getChannelCount(client),
      getEmojiCount(client),
    ])

  const modules = this.sleet.modules.size
  const uptime = client.readyAt
  const created = client.user?.createdAt ?? null

  const embed = new EmbedBuilder().setTitle('Stats').addFields([
    { name: 'Guilds:', value: String(guildCount), inline: true },
    { name: 'Members:', value: String(memberCount), inline: true },
    { name: 'Users Cached:', value: String(userCount), inline: true },
    { name: 'Channels:', value: String(channelCount), inline: true },
    { name: 'Emojis Cached:', value: String(emojis), inline: true },
    { name: 'Modules Loaded:', value: String(modules), inline: true },
    { name: 'Uptime:', value: createTimestamps(uptime), inline: true },
    { name: 'Created:', value: createTimestamps(created), inline: true },
  ])

  if (client.user) {
    embed.setAuthor({
      name: client.user.tag,
    })

    embed.setThumbnail(client.user.displayAvatarURL())
  }

  interaction.reply({ embeds: [embed] })
}

/**
 * Sum up an array of numbers
 * @param counts The numbers to sum
 * @returns The sum of all the numbers
 */
function sum(counts: number[]): number {
  return counts.reduce((acc, count) => acc + count, 0)
}

/** A function that takes in the current client as context, and then should return some number */
type GetClientCount = (client: Client) => number

/**
 * A way to get the count of *something* from the client that works for both sharded and unsharded clients
 * @param client The client to get a count for
 * @param getClientCount A function that uses the client to get a count
 * @returns A sum of the counts from all clients if sharded, the count of the current client if not
 */
async function getCount(
  client: Client,
  getClientCount: GetClientCount,
): Promise<number> {
  if (client.shard) {
    return client.shard.broadcastEval(getClientCount).then(sum)
  } else {
    return getClientCount(client)
  }
}

async function getGuildCount(client: Client): Promise<number> {
  return getCount(client, c => c.guilds.cache.size)
}

async function getMemberCount(client: Client): Promise<number> {
  const sumMembers = (acc: number, guild: Guild) => acc + guild.memberCount
  return getCount(client, c => c.guilds.cache.reduce(sumMembers, 0))
}

async function getUserCount(client: Client): Promise<number> {
  return getCount(client, c => c.users.cache.size)
}

async function getChannelCount(client: Client): Promise<number> {
  return getCount(client, c => c.channels.cache.size)
}

async function getEmojiCount(client: Client): Promise<number> {
  return getCount(client, c => c.emojis.cache.size)
}

/**
 * Formats a date into a few timestamp formats for display
 * @param time The time to create a timestamp for
 * @returns An "x since" formatted string, absolute discord timestamp, relative discord timestamp
 */
function createTimestamps(time: Date | null): string {
  if (!time) return 'Never'

  const ms = time.getTime()
  const unixSeconds = Math.floor(ms / 1000)
  const formatted = formatTimeToString(ms, TIME_FORMAT)
  const absTime = `<t:${unixSeconds}>`
  const relTime = `<t:${unixSeconds}:R>`

  return `${formatted}\n${absTime}\n${relTime}`
}

const TIME_FORMAT = '{w} {week} {d} {day} {hh}:{mm}:{ss}'

// TODO: global time util
/* eslint-disable no-cond-assign */
function formatTimeToString(time: number, text: string): string {
  const rep = new Map()

  rep
    .set('w', time / 604800000)
    .set('week', rep.get('w') === 1 ? 'week' : 'weeks')
    .set('d', (time %= 604800000) ? time / 86400000 : 0)
    .set('day', rep.get('d') === 1 ? 'day' : 'days')
    .set('h', (time %= 86400000) ? time / 3600000 : 0)
    .set(
      'hh',
      Math.floor(rep.get('h')) < 10
        ? `0${Math.floor(rep.get('h'))}`
        : `${Math.floor(rep.get('h'))}`,
    )
    .set('hour', rep.get('h') === 1 ? 'hour' : 'hours')
    .set('m', (time %= 3600000) ? time / 60000 : 0)
    .set(
      'mm',
      Math.floor(rep.get('m')) < 10
        ? `0${Math.floor(rep.get('m'))}`
        : `${Math.floor(rep.get('m'))}`,
    )
    .set('minute', rep.get('m') === 1 ? 'minute' : 'minutes')
    .set('s', (time %= 60000) ? time / 1000 : 0)
    .set(
      'ss',
      Math.floor(rep.get('s')) < 10
        ? `0${Math.floor(rep.get('s'))}`
        : `${Math.floor(rep.get('s'))}`,
    )
    .set('second', rep.get('s') === 1 ? 'second' : 'seconds')

  for (const [format, val] of rep) {
    text = text.replace(
      new RegExp(`{${format}}`, 'g'),
      typeof val === 'number' ? Math.floor(val) : val,
    )
  }

  return text
}
