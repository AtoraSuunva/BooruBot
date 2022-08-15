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
import { getReferenceIdFor } from '../utils.js'

export const blacklistClear = new SleetSlashSubcommand(
  {
    name: 'clear',
    description: 'Clear the blacklist',
    options: [
      {
        name: 'confirm',
        description: 'Confirm the clear, bypassing the confirmation prompt',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runClear,
  },
)

async function runClear(interaction: ChatInputCommandInteraction) {
  const defer = interaction.deferReply({ fetchReply: true })

  const confirm = interaction.options.getBoolean('confirm', false)
  const referenceId = getReferenceIdFor(interaction)
  const config = database.booruConfig.findFirst({
    where: { referenceId },
  })

  const message = await defer

  if (!config) {
    interaction.editReply('No Booru config found, so no blacklist to clear.')
    return
  }

  if (confirm === true) {
    await clearBlacklist(referenceId)
    interaction.editReply('Blacklist cleared.')
    return
  }

  const deleteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`blacklist/clear:${referenceId},${interaction.user.id}`)
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

      await clearBlacklist(referenceId)

      interaction.editReply({
        content: `Welcome config deleted. Requested by ${interaction.user}`,
        components: [],
      })

      await defer
      i.editReply('Blacklist cleared.')

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

function clearBlacklist(referenceId: string) {
  return Promise.all([
    database.tag.deleteMany({ where: { referenceId } }),
    database.site.deleteMany({ where: { referenceId } }),
  ])
}
