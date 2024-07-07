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
import { prisma } from '../../util/db.js'
import { getInteractionChannel } from '../search/searchUtils.js'
import { channelOption, getReferenceFor } from '../utils.js'
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
      channelOption,
    ],
  },
  {
    run: runSetMinScore,
  },
)

async function runSetMinScore(interaction: ChatInputCommandInteraction) {
  const score = interaction.options.getNumber('score')
  const reference = await getReferenceFor(interaction)
  const channel = await getInteractionChannel(interaction)

  const defer = interaction.deferReply()

  const config = await prisma.booruConfig.upsert({
    where: { referenceId: reference.id },
    create: {
      referenceId: reference.id,
      minScore: score,
      guildId: reference.guildId,
      isGuild: reference.isGuild,
      // null if in channel, true if in guild, false if in DM
      allowNSFW:
        reference.guildId && !channel.isDMBased() ? null : reference.isGuild,
    },
    update: { minScore: score },
    include: { defaultTags: true },
  })

  await defer

  const view = createConfigView(config)
  return interaction.editReply(view)
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
      channelOption,
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

  if (!allowNSFW) {
    return setAllowNSFWAndReply(interaction, interaction, false)
  }

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

  collector.on('collect', (i) => {
    if (i.user.id !== interaction.user.id) {
      return void i.reply({
        content: "You can't confirm this.",
        ephemeral: true,
      })
    }

    if (i.customId === ALLOW_NSFW_CONFIRM) {
      void setAllowNSFWAndReply(i, interaction, true)
    } else {
      void i.reply({
        content: 'You cancelled this.',
        ephemeral: true,
      })
    }

    collector.stop()
  })

  collector.on('end', () => {
    void interaction.editReply({ components: [] })
  })

  return
}

async function setAllowNSFWAndReply(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  referenceInteraction: ChatInputCommandInteraction,
  allowNSFW: boolean,
) {
  const reference = await getReferenceFor(referenceInteraction)

  const defer = interaction.deferReply()

  const config = await prisma.booruConfig.upsert({
    where: { referenceId: reference.id },
    create: {
      referenceId: reference.id,
      allowNSFW,
      guildId: reference.guildId,
      isGuild: reference.isGuild,
    },
    update: { allowNSFW },
    include: { defaultTags: true },
  })

  await defer

  const view = createConfigView(config)
  return interaction.editReply(view)
}

export const configSet = new SleetSlashCommandGroup({
  name: 'set',
  description: 'Set an option in the config',
  options: [setMinScore, setAllowNSFW],
})
