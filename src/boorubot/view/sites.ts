import { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'

export const viewSites = new SleetSlashSubcommand(
  {
    name: 'sites',
    description: 'Get a list of all sites that BooruBot supports',
  },
  {
    run: runViewSites,
  },
)

const SITES_URL =
  'https://github.com/AtlasTheBot/Booru-Discord/blob/master/sites.md'
const SITES_MESSAGE = `You can view all supported sites at ${SITES_URL}`

function runViewSites(interaction: ChatInputCommandInteraction) {
  interaction.reply({
    content: SITES_MESSAGE,
    ephemeral: true,
  })
}
