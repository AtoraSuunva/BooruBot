import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashCommandGroup, SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { getReferenceIdFor } from '../utils.js'
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
  const referenceId = getReferenceIdFor(interaction)

  const defer = interaction.deferReply()

  const config = await database.booruConfig.upsert({
    where: { referenceId },
    create: { referenceId, minScore: score },
    update: { minScore: score },
  })

  settingsCache.setConfig(referenceId, config)

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

async function runSetAllowNSFW(interaction: ChatInputCommandInteraction) {
  const allowNSFW = interaction.options.getBoolean('allow', true)
  const referenceId = getReferenceIdFor(interaction)

  const defer = interaction.deferReply()

  const config = await database.booruConfig.upsert({
    where: { referenceId },
    create: { referenceId, allowNSFW },
    update: { allowNSFW },
  })

  settingsCache.setConfig(referenceId, config)

  await defer

  const view = createConfigView(config)
  interaction.editReply(view)
}

export const configSet = new SleetSlashCommandGroup({
  name: 'set',
  description: 'Set an option in the config',
  options: [setMinScore, setAllowNSFW],
})
