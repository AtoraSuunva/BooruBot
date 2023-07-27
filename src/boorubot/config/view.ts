import { BooruConfig } from '@prisma/client'
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { getReferenceFor } from '../utils.js'

export const configView = new SleetSlashSubcommand(
  {
    name: 'view',
    description: 'View the config',
  },
  {
    run: runView,
  },
)

async function runView(interaction: ChatInputCommandInteraction) {
  const reference = getReferenceFor(interaction)

  const defer = interaction.deferReply()

  const config = await prisma.booruConfig.findFirst({
    where: { referenceId: reference.id },
  })

  await defer

  if (!config) {
    return interaction.editReply('No Booru config found, so no config to view.')
  }

  settingsCache.setConfig(reference.id, config)

  const view = createConfigView(config)
  return interaction.editReply(view)
}

export function createConfigView(config: BooruConfig) {
  // TODO: just text, it was nicer
  const embed = new EmbedBuilder().setTitle('Booru Config').addFields([
    {
      name: 'Min Score',
      value:
        config.minScore === null ? 'No Min Score' : String(config.minScore),
      inline: true,
    },
    {
      name: 'Allow NSFW',
      value: String(config.allowNSFW),
      inline: true,
    },
  ])

  return { embeds: [embed] }
}
