import type { Prisma } from '@prisma/client'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { channelOption, getReferenceFor } from '../utils.js'

export const blacklistDelete = new SleetSlashSubcommand(
  {
    name: 'delete',
    description: 'Delete the blacklist',
    options: [
      {
        name: 'confirm',
        description: 'Confirm the delete, bypassing the confirmation prompt',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'full',
        description:
          'Delete the config for the entire server, including any per-channel config (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      channelOption,
    ],
  },
  {
    run: runDelete,
  },
)

async function runDelete(interaction: ChatInputCommandInteraction) {
  const defer = interaction.deferReply({ withResponse: true })

  const confirm = interaction.options.getBoolean('confirm', false) ?? false
  const full = interaction.options.getBoolean('full', false) ?? false

  const reference = await getReferenceFor(interaction)

  const response = await defer

  if (confirm) {
    await deleteBlacklist(reference.id, full)
    return interaction.editReply('Blacklist deleted.')
  }

  const cancelButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(`blacklist/cancel:${reference.id},${interaction.user.id}`)
    .setLabel('Cancel')

  const deleteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`blacklist/delete:${reference.id},${interaction.user.id}`)
    .setLabel('Delete Guild Config')

  const fullDeleteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`blacklist/fulldelete:${reference.id},${interaction.user.id}`)
    .setLabel('Delete Guild and All Channel Configs')

  const row = new ActionRowBuilder<ButtonBuilder>()

  if (full) {
    row.addComponents([cancelButton, fullDeleteButton])
  } else {
    row.addComponents([cancelButton, deleteButton, fullDeleteButton])
  }

  await interaction.editReply({
    content: 'Are you sure? You **CANNOT** undo this!!!',
    components: [row],
  })

  const message = response.resource?.message ?? (await interaction.fetchReply())

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60 * 1000,
  })

  collector.on('collect', async (i) => {
    if (i.user.id === interaction.user.id) {
      if (i.customId.startsWith('blacklist/cancel:')) {
        await i.reply({
          content: 'Cancelled.',
          flags: MessageFlags.Ephemeral,
        })
        collector.stop()
        return
      }

      const defer = i.deferReply({ flags: MessageFlags.Ephemeral })

      const isFull = i.customId.startsWith('blacklist/fulldelete:')
      await deleteBlacklist(reference.id, isFull || full)

      await interaction.editReply({
        content: `Blacklist deleted. Requested by ${interaction.user}`,
        components: [],
      })

      await defer
      await i.editReply('Blacklist deleted.')

      collector.stop()
    } else {
      await i.reply({
        flags: MessageFlags.Ephemeral,
        content: `Only ${interaction.user} can confirm this deletion.`,
      })
    }
  })

  collector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      void interaction.editReply({
        content: 'Deletion timed out',
        components: [],
      })
    }
  })

  return
}

async function deleteBlacklist(referenceId: string, full = false) {
  const promises = await collectDeletePromises(referenceId, full)
  return prisma.$transaction(promises)
}

async function collectDeletePromises(
  referenceId: string,
  full = false,
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const deletePromises: Prisma.PrismaPromise<unknown>[] = []

  if (full) {
    // Find all configs that have this referenceId as guildId and then delete them
    const guildConfigs = await prisma.booruConfig.findMany({
      select: { referenceId: true },
      where: { guildId: referenceId },
    })

    const allPromises = await Promise.all(
      guildConfigs.flatMap(({ referenceId }) =>
        collectDeletePromises(referenceId, false),
      ),
    )

    deletePromises.push(...allPromises.flat(1))
  }

  deletePromises.push(
    prisma.tag.deleteMany({ where: { referenceId } }),
    prisma.site.deleteMany({ where: { referenceId } }),
  )

  return deletePromises
}
