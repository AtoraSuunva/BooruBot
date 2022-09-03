import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageComponentInteraction,
} from 'discord.js'
import { SleetSlashCommandGroup, SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { getReferenceFor } from '../utils.js'
import { createConfigView } from './view.js'

const setMinScore = new SleetSlashSubcommand(
  {
    name: 'min_score',
    description: 'Set the minimum score required for a result to be shown',
    options: [
      {
        name: 'score',
        description: 'The minimum score required',
        type: ApplicationCommandOptionType.Number,
      },
    ],
  },
  {
    run: runSetMinScore,
  },
)

async function runSetMinScore(interaction: ChatInputCommandInteraction) {
  const score = interaction.options.getNumber('score')
  const reference = getReferenceFor(interaction)

  const defer = interaction.deferReply()

  const config = await database.booruConfig.upsert({
    where: { referenceId: reference.id },
    create: {
      referenceId: reference.id,
      minScore: score,
      isGuild: reference.isGuild,
    },
    update: { minScore: score },
  })

  settingsCache.setConfig(reference.id, config)

  await defer

  const view = createConfigView(config)
  interaction.editReply(view)
}

// --

const setAllowNSFW = new SleetSlashSubcommand(
  {
    name: 'allow_nsfw',
    description:
      'Set whether NSFW results are allowed. NSFW results are only shown in age-restricted channels or DMs',
    options: [
      {
        name: 'allow',
        description: 'Should NSFW results ever be shown?',
        type: ApplicationCommandOptionType.Boolean,
        required: true,
      },
    ],
  },
  {
    run: runSetAllowNSFW,
  },
)

const ALLOW_NSFW_CONFIRM = 'config/allow_nsfw/confirm'
const ALLOW_NSFW_DENY = 'config/allow_nsfw/deny'

async function runSetAllowNSFW(interaction: ChatInputCommandInteraction) {
  const allowNSFW = interaction.options.getBoolean('allow', true)

  if (allowNSFW) {
    const row = new ActionRowBuilder<ButtonBuilder>()
    const confirmButton = new ButtonBuilder()
      .setCustomId(ALLOW_NSFW_CONFIRM)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Allow')
    const denyButton = new ButtonBuilder()
      .setCustomId(ALLOW_NSFW_DENY)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Deny')

    row.setComponents([confirmButton, denyButton])

    const extraMessage = interaction.inGuild()
      ? 'NSFW results only will be shown in channels marked as age-restricted.'
      : 'NSFW results will be shown in DMs with the bot.'

    const message = await interaction.reply({
      content: `Allow NSFW results? By enabling this, you confirm that you are 18+ and legally able to view NSFW content.\n> ${extraMessage}`,
      components: [row],
      fetchReply: true,
    })

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: 5 * 60 * 1000,
    })

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        i.reply({
          content: "You can't confirm this.",
          ephemeral: true,
        })
        return
      }

      if (i.customId === ALLOW_NSFW_CONFIRM) {
        setAllowNSFWAndReply(i, true)
      } else {
        i.reply({
          content: 'You cancelled this.',
          ephemeral: true,
        })
      }
      collector.stop()
    })

    collector.on('end', () => {
      interaction.editReply({ components: [] })
    })
  } else {
    setAllowNSFWAndReply(interaction, allowNSFW)
  }
}

async function setAllowNSFWAndReply(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  allowNSFW: boolean,
) {
  const reference = getReferenceFor(interaction)

  const defer = interaction.deferReply()

  const config = await database.booruConfig.upsert({
    where: { referenceId: reference.id },
    create: {
      referenceId: reference.id,
      allowNSFW,
      isGuild: reference.isGuild,
    },
    update: { allowNSFW },
  })

  settingsCache.setConfig(reference.id, config)

  await defer

  const view = createConfigView(config)
  interaction.editReply(view)
}

export const configSet = new SleetSlashCommandGroup({
  name: 'set',
  description: 'Set an option in the config',
  options: [setMinScore, setAllowNSFW],
})
