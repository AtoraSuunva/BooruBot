import { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { getReferenceIdFor } from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

export const blacklistList = new SleetSlashSubcommand(
  {
    name: 'list',
    description: 'List the tags and sites in the blacklist',
    options: [],
  },
  {
    run: runList,
  },
)

async function runList(interaction: ChatInputCommandInteraction) {
  const referenceId = getReferenceIdFor(interaction)
  const blacklist = await getBlacklistFor(referenceId)
  const formattedBlacklist = formatBlacklist(blacklist)
  interaction.reply(formattedBlacklist)
}
