import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { getReferenceFor } from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

export const blacklistView = new SleetSlashSubcommand(
  {
    name: 'view',
    description: 'View the tags and sites in the blacklist',
    options: [
      {
        name: 'ephemeral',
        description:
          'Reply with a public post everyone can see (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runView,
  },
)

export async function runView(interaction: ChatInputCommandInteraction) {
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false
  const reference = getReferenceFor(interaction)
  const blacklist = await getBlacklistFor(reference.id)
  const formattedBlacklist = formatBlacklist(blacklist)

  return interaction.reply({
    ...formattedBlacklist,
    ephemeral,
  })
}
