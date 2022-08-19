import { BooruConfig } from '@prisma/client'
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { getReferenceIdFor } from '../utils.js'

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
  const referenceId = getReferenceIdFor(interaction)

  const defer = interaction.deferReply()

  const config = await database.booruConfig.findFirst({
    where: { referenceId },
  })

  await defer

  if (!config) {
    interaction.editReply('No Booru config found, so no config to view.')
    return
  }

  settingsCache.setConfig(referenceId, config)

  const view = createConfigView(config)
  interaction.editReply(view)
}

export function createConfigView(config: BooruConfig) {
  const embed = new EmbedBuilder().setTitle('Booru Config').addFields([
    {
      name: 'Min Score',
      value: String(config.minScore),
    },
  ])

  return { embeds: [embed] }
}
