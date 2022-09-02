import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { getReferenceIdFor } from '../utils.js'

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
  const referenceId = getReferenceIdFor(interaction)
  const config = database.booruConfig.findFirst({
    where: { referenceId },
  })

  const message = await defer

  if (!config) {
    interaction.editReply('No Booru config found, so no blacklist to delete.')
    return
  }

  if (confirm === true) {
    await deleteBlacklist(referenceId)
    interaction.editReply('Blacklist deleted.')
    return
  }

  const deleteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`blacklist/delete:${referenceId},${interaction.user.id}`)
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

      await deleteBlacklist(referenceId)

      interaction.editReply({
        content: `Blacklist deleted. Requested by ${interaction.user}`,
        components: [],
      })

      await defer
      i.editReply('Blacklist deleted.')

      collector.stop()
    } else {
      i.reply({
        ephemeral: true,
        content: `Only ${interaction.user} can confirm this deletion.`,
      })
    }
  })

  collector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      interaction.editReply({
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
    database.tag.deleteMany({ where: { referenceId } }),
    database.site.deleteMany({ where: { referenceId } }),
  ])
}
