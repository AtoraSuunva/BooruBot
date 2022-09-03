import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { Reference, settingsCache } from '../SettingsCache.js'
import { ensureConfigFor, getItemsFrom, getReferenceFor } from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

export const blacklistAddTags = new SleetSlashSubcommand(
  {
    name: 'tags',
    description: 'Add tags to the blacklist',
    options: [
      {
        name: 'tags',
        description: 'The tag(s) to add, separated by a space',
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
        description: 'The tag(s) to remove, separated by a space',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    run: makeTagModifier(removeTags),
  },
)

type TagAction = (reference: Reference, tags: string[]) => Promise<void>

function makeTagModifier(tagAction: TagAction) {
  return async function (interaction: ChatInputCommandInteraction) {
    const reference = getReferenceFor(interaction)
    const tags = getItemsFrom(interaction.options.getString('tags', true))

    if (tags.length === 0) {
      return interaction.reply({
        content: 'You must provide at least one tag',
        ephemeral: true,
      })
    }

    const defer = interaction.deferReply()
    await tagAction(reference, tags)
    await defer

    const formattedBlacklist = formatBlacklist(
      await getBlacklistFor(reference.id),
      {
        highlightTags: tags,
      },
    )

    return interaction.editReply(formattedBlacklist)
  }
}

async function addTags(reference: Reference, tags: string[]) {
  await ensureConfigFor(reference)

  const tagsToAdd = tags.map((tag) => ({
    referenceId: reference.id,
    name: tag,
  }))

  await database.tag.createMany({
    data: tagsToAdd,
    skipDuplicates: true,
  })

  settingsCache.deleteTags(reference.id)
}

async function removeTags(reference: Reference, tags: string[]) {
  await ensureConfigFor(reference)

  await database.tag.deleteMany({
    where: { name: { in: tags } },
  })

  settingsCache.deleteTags(reference.id)
}
