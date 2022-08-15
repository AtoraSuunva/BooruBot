import {
  ChatInputCommandInteraction,
  CommandInteraction,
  EmbedBuilder,
  Team,
  User,
  version as discordJSVersion,
} from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import * as os from 'node:os'

/**
 * Get some info about the bot, currently includes:
 *   - Owner
 *   - Version (Node/d.js)
 *   - CPU Load Average
 *   - Memory Usage
 */
export const info = new SleetSlashCommand(
  {
    name: 'info',
    description: 'Get info about the bot',
  },
  {
    run: runInfo,
  },
)

/** Get the info! */
async function runInfo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()

  if (interaction.client.user) {
    embed.setAuthor({
      name: interaction.client.user.tag,
    })

    embed.setThumbnail(interaction.client.user.displayAvatarURL())
  }

  const owner = getOwner(interaction)
  const ownerString = formatOwner(owner)
  const versionInfo = `Node ${process.version}\ndiscord.js v${discordJSVersion}`
  const cpuString = os.loadavg().join(', ')

  const totalMem = os.totalmem()
  const usedMem = os.totalmem() - os.freemem()
  const usedMemPercent = ((usedMem / totalMem) * 100).toFixed(2)
  const memoryString = `${formatBytes(usedMem)} / ${formatBytes(
    totalMem,
  )} (${usedMemPercent}%)`

  embed.addFields([
    { name: 'Owner', value: ownerString, inline: true },
    { name: 'Using', value: versionInfo, inline: true },
    { name: 'CPU Load Average', value: cpuString, inline: false },
    { name: 'Memory Usage', value: memoryString, inline: true },
  ])

  interaction.reply({
    embeds: [embed],
  })
}

/**
 * Formats a number of bytes into a format like `512.00 MB`, using the "best-fit" unit size
 * @param bytes The bytes to format
 * @param decimals The number of decimals to show
 * @returns A string representation of the byte size, with the appropriate unit
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  const k = 1000,
    dm = decimals + 1 || 3,
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/** Details about who the owner is, and if they're a team */
interface OwnerDetails {
  name: string
  id: string
  tag: string
  isTeam: boolean
}

/** Get the current owner of the bot/application */
function getOwner(interaction: CommandInteraction): OwnerDetails {
  const owner = interaction.client.application?.owner ?? null

  if (owner instanceof User) {
    return {
      name: owner.username,
      id: owner.id,
      tag: owner.tag,
      isTeam: false,
    }
  } else if (owner instanceof Team) {
    return {
      name: owner.name,
      id: owner.id,
      tag: owner.owner?.user.tag ?? 'Unknown team owner',
      isTeam: true,
    }
  } else {
    return {
      name: 'Unknown',
      id: 'Unknown',
      tag: 'Unknown',
      isTeam: false,
    }
  }
}

/**
 * Formats the owner details into a string, dealing with teams appropriately
 * @param owner The owner details
 * @returns A string representation of the owner details
 */
function formatOwner(owner: OwnerDetails): string {
  const isTeam = owner.isTeam
  const tag = owner.tag
  const id = owner.id
  const name = owner.name

  if (id === 'Unknown') {
    return 'Unknown'
  }

  if (isTeam) {
    return `Team: ${name} (Owned by ${tag})`
  } else {
    return tag
  }
}
