import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import { ensureConfigFor, getItemsFrom, getReferenceIdFor } from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

export const blacklistAddTags = new SleetSlashSubcommand(
  {
    name: 'tags',
    description: 'Add tags to the blacklist',
    options: [
      {
        name: 'tags',
        description: 'The tag(s) to add, separated by a comma',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    run: makeTagModifier(addTags),
  },
)

export const blacklistRemoveTags = new SleetSlashSubcommand(
  {
    name: 'tags',
    description: 'Remove tags from the blacklist',
    options: [
      {
        name: 'tags',
        description: 'The tag(s) to remove, separated by a comma',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    run: makeTagModifier(removeTags),
  },
)

type TagAction = (referenceId: string, tags: string[]) => Promise<void>

function makeTagModifier(tagAction: TagAction) {
  return async function (interaction: ChatInputCommandInteraction) {
    const referenceId = getReferenceIdFor(interaction)
    const tags = getItemsFrom(interaction.options.getString('tags', true))

    if (tags.length === 0) {
      return interaction.reply({
        content: 'You must provide at least one tag',
        ephemeral: true,
      })
    }

    const defer = interaction.deferReply()
    await tagAction(referenceId, tags)
    await defer

    const formattedBlacklist = formatBlacklist(
      await getBlacklistFor(referenceId),
      {
        highlightTags: tags,
      },
    )

    return interaction.editReply(formattedBlacklist)
  }
}

async function addTags(referenceId: string, tags: string[]) {
  await ensureConfigFor(referenceId)

  // TODO: createMany on non-SQLite
  const tagsToAdd = tags.map((tag) => ({
    referenceId,
    name: tag,
  }))

  for (const tag of tagsToAdd) {
    await database.tag.upsert({
      where: { referenceId_name: tag },
      create: tag,
      update: tag,
    })
  }

  settingsCache.deleteTags(referenceId)
}

async function removeTags(referenceId: string, tags: string[]) {
  await ensureConfigFor(referenceId)

  await database.tag.deleteMany({
    where: { name: { in: tags } },
  })

  settingsCache.deleteTags(referenceId)
}
