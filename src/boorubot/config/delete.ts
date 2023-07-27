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

export const configDelete = new SleetSlashSubcommand(
  {
    name: 'delete',
    description: 'Delete the config',
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
  const config = await prisma.booruConfig.findFirst({
    where: { referenceId: reference.id },
  })

  const message = await defer

  if (config) {
    return interaction.editReply(
      'No Booru config found, so no config to delete.',
    )
  }

  if (confirm === true) {
    await deleteConfig(reference.id)
    return interaction.editReply('Config deleted.')
  }

  const deleteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`config/delete:${reference.id},${interaction.user.id}`)
    .setLabel('Confirm Delete')

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton)

  await interaction.editReply({
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

      await deleteConfig(reference.id)

      await interaction.editReply({
        content: `Booru config deleted. Requested by ${interaction.user}`,
        components: [],
      })

      await defer
      await i.editReply('Config deleted.')

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
      return void interaction.editReply({
        content: 'Deletion timed out',
        components: [],
      })
    }
  })

  return
}

function deleteConfig(referenceId: string) {
  // deletes should be cascaded, or at least let's make sure we have fresh data after this
  settingsCache.deleteConfig(referenceId)
  settingsCache.deleteTags(referenceId)
  settingsCache.deleteSites(referenceId)

  return prisma.booruConfig.delete({ where: { referenceId } })
}
