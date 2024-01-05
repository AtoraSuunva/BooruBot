import { Prisma } from '@prisma/client'
import { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { notNullish } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'
import { settingsCache } from '../SettingsCache.js'
import { getInteractionChannel } from '../search/searchUtils.js'
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

export async function runView(
  interaction: ChatInputCommandInteraction,
  shouldDefer = true,
) {
  const reference = await getReferenceFor(interaction)
  const channel = await getInteractionChannel(interaction)

  let defer
  if (shouldDefer) {
    defer = interaction.deferReply()
  }

  const [guildConfig, channelConfig] = await Promise.all([
    prisma.booruConfig.findFirst({
      where: { referenceId: reference.id },
      include: {
        defaultTags: true,
      },
    }),
    prisma.booruConfig.findFirst({
      where: { referenceId: channel.id },
      include: {
        defaultTags: true,
      },
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

type ConfigView = Prisma.BooruConfigGetPayload<{
  include: {
    defaultTags: true
  }
}>

export function createConfigView(...configs: ConfigView[]) {
  return { content: configs.map(singleConfigView).join('\n') }
}

function singleConfigView(config: ConfigView) {
  const header = config.isGuild
    ? 'Guild Config'
    : config.guildId
      ? `Channel Config: <#${config.referenceId}>`
      : 'User Config'

  const shownConfig = {
    minScore: config.minScore,
    allowNSFW: config.allowNSFW,
    defaultTags: config.defaultTags.map((t) => t.name).join(', '),
  }

  const formatted = formatConfig({
    config: shownConfig,
  })

  return `${header}\n${formatted}`
}
