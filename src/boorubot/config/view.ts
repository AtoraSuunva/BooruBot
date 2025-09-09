import type { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { notNullish } from 'sleetcord-common'
import type { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../helpers/db.js'
import { formatConfig } from '../../helpers/format.js'
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
  recurse = true,
) {
  const reference = await getReferenceFor(interaction)
  const channel = reference.isGuild
    ? await getInteractionChannel(interaction)
    : null

  if (shouldDefer) {
    await interaction.deferReply()
  }

  const [guildOrUserConfig, channelConfig] = await Promise.all([
    prisma.booruConfig.findFirst({
      where: { referenceId: reference.id },
      include: {
        defaultTags: true,
      },
    }),
    channel === null
      ? null
      : prisma.booruConfig.findFirst({
          where: { referenceId: channel.id },
          include: {
            defaultTags: true,
          },
        }),
  ])

  let modified = false

  if (
    interaction.guildId === reference.id &&
    guildOrUserConfig &&
    !guildOrUserConfig.isGuild
  ) {
    // For some reason it's not marked as a guild, fix that
    await prisma.booruConfig.update({
      where: { referenceId: interaction.guildId },
      data: { isGuild: true },
    })
    modified = true
  }

  if (
    interaction.guildId &&
    channel &&
    channel.id === reference.id &&
    channelConfig &&
    (channelConfig.isGuild || channelConfig.guildId === null)
  ) {
    // For some reason it's not marked as a channel, fix that
    await prisma.booruConfig.update({
      where: { referenceId: channel.id },
      data: { isGuild: false, guildId: interaction.guildId },
    })
    modified = true
  }

  if (modified && recurse) {
    return runView(interaction, false, false)
  }

  if (!guildOrUserConfig && !channelConfig) {
    return interaction.editReply('No Booru config found, so no config to view.')
  }

  const view = createConfigView(
    ...[guildOrUserConfig, channelConfig].filter(notNullish),
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
