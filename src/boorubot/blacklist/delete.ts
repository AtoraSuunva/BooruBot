import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { getReferenceFor } from '../utils.js'

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
    ],
  },
  {
    run: runDelete,
  },
)

async function runDelete(interaction: ChatInputCommandInteraction) {
  const defer = interaction.deferReply({ fetchReply: true })

  const confirm = interaction.options.getBoolean('confirm', false)
  const reference = getReferenceFor(interaction)
  const config = prisma.booruConfig.findFirst({
    where: { referenceId: reference.id },
  })

  const message = await defer

  if (!config) {
    interaction.editReply('No Booru config found, so no blacklist to delete.')
    return
  }

  if (confirm === true) {
    await deleteBlacklist(reference.id)
    interaction.editReply('Blacklist deleted.')
    return
  }

  const deleteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`blacklist/delete:${reference.id},${interaction.user.id}`)
    .setLabel('Confirm Delete')

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton)

  interaction.editReply({
    content: 'Are you sure? You **CANNOT** undo this!!!',
    components: [row],
  })

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60 * 1000,
  })

  collector.on('collect', async (i) => {
    if (i.user.id === interaction.user.id) {
      const defer = i.deferReply({ ephemeral: true })

      await deleteBlacklist(reference.id)

      await interaction.editReply({
        content: `Blacklist deleted. Requested by ${interaction.user}`,
        components: [],
      })

      await defer
      await i.editReply('Blacklist deleted.')

      collector.stop()
    } else {
      await i.reply({
        ephemeral: true,
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
}

function deleteBlacklist(referenceId: string) {
  settingsCache.deleteTags(referenceId)
  settingsCache.deleteSites(referenceId)

  return Promise.all([
    prisma.tag.deleteMany({ where: { referenceId } }),
    prisma.site.deleteMany({ where: { referenceId } }),
  ])
}
