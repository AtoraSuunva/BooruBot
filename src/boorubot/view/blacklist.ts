import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { runView } from '../blacklist/view.js'

export const viewBlacklist = new SleetSlashSubcommand(
  {
    name: 'blacklist',
    description: 'View the blacklist for this server',
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
    run: runViewBlacklist,
  },
)

function runViewBlacklist(interaction: ChatInputCommandInteraction) {
  runView(interaction)
}
