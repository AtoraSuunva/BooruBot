import { BooruConfig } from '@prisma/client'
import { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { notNullish } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'
import { settingsCache } from '../SettingsCache.js'
import { channelOption, getReferenceFor } from '../utils.js'

export const configView = new SleetSlashSubcommand(
  {
    name: 'view',
    description: 'View the config',
    options: [channelOption],
  },
  {
    run: runView,
  },
)

async function runView(interaction: ChatInputCommandInteraction) {
  const reference = getReferenceFor(interaction)

  const defer = interaction.deferReply()

  const [guildConfig, channelConfig] = await Promise.all([
    prisma.booruConfig.findFirst({
      where: { referenceId: reference.id },
    }),
    prisma.booruConfig.findFirst({
      where: { referenceId: interaction.channelId },
    }),
  ])

  await defer

  if (!guildConfig && !channelConfig) {
    return interaction.editReply('No Booru config found, so no config to view.')
  }

  if (guildConfig) {
    settingsCache.setConfig(reference.id, guildConfig)
  }

  if (channelConfig) {
    settingsCache.setConfig(interaction.channelId, channelConfig)
  }

  const view = createConfigView(
    ...[guildConfig, channelConfig].filter(notNullish),
  )
  return interaction.editReply(view)
}

export function createConfigView(...configs: BooruConfig[]) {
  return { content: configs.map(singleConfigView).join('\n') }
}

function singleConfigView(config: BooruConfig) {
  const header = config.isGuild
    ? 'Guild Config'
    : config.guildId
      ? `Channel Config: <#${config.referenceId}>`
      : 'User Config'

  const shownConfig = {
    minScore: config.minScore,
    allowNSFW: config.allowNSFW,
  }

  const formatted = formatConfig({
    config: shownConfig,
  })

  return `${header}\n${formatted}`
}
