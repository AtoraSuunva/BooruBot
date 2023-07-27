import {
  Client,
  Guild,
  EmbedBuilder,
  ChatInputCommandInteraction,
  time,
} from 'discord.js'
import prettyMilliseconds from 'pretty-ms'
import { SleetSlashCommand, SleetContext, formatUser } from 'sleetcord'

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
  const created = client.user.createdAt

  const embed = new EmbedBuilder()
    .setTitle('Stats')
    .addFields([
      { name: 'Guilds:', value: guildCount.toLocaleString(), inline: true },
      { name: 'Members:', value: memberCount.toLocaleString(), inline: true },
      {
        name: 'Users Cached:',
        value: userCount.toLocaleString(),
        inline: true,
      },
      { name: 'Channels:', value: channelCount.toLocaleString(), inline: true },
      { name: 'Emojis Cached:', value: emojis.toLocaleString(), inline: true },
      {
        name: 'Modules Loaded:',
        value: modules.toLocaleString(),
        inline: true,
      },
      { name: 'Uptime:', value: createTimestamps(uptime), inline: true },
      { name: 'Created:', value: createTimestamps(created), inline: true },
    ])
    .setAuthor({
      name: formatUser(client.user, { markdown: false, escape: false }),
    })
    .setThumbnail(client.user.displayAvatarURL())

  await interaction.reply({ embeds: [embed] })
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
  return getCount(client, (c) => c.guilds.cache.size)
}

async function getMemberCount(client: Client): Promise<number> {
  const sumMembers = (acc: number, guild: Guild) => acc + guild.memberCount
  return getCount(client, (c) => c.guilds.cache.reduce(sumMembers, 0))
}

async function getUserCount(client: Client): Promise<number> {
  return getCount(client, (c) => c.users.cache.size)
}

async function getChannelCount(client: Client): Promise<number> {
  return getCount(client, (c) => c.channels.cache.size)
}

async function getEmojiCount(client: Client): Promise<number> {
  return getCount(client, (c) => c.emojis.cache.size)
}

/**
 * Formats a date into a few timestamp formats for display
 * @param date The time to create a timestamp for
 * @returns An "x since" formatted string, absolute discord timestamp, relative discord timestamp
 */
function createTimestamps(date: Date | null): string {
  if (!date) return 'Never'

  const formatted = prettyMilliseconds(Date.now() - date.getTime(), {
    verbose: true,
  })

  return `${formatted}\n${time(date)}\n${time(date, 'R')}`
}
