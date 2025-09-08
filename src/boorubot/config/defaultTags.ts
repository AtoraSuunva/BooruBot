import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { type AutocompleteHandler, SleetSlashSubcommand } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { makeTagAutocomplete } from '../blacklist/tag.js'
import { type Reference, settingsCache } from '../SettingsManager.js'
import { channelOption, getItemsFrom, getReferenceFor } from '../utils.js'
import { runView } from './view.js'

export const configAddDefaultTags = new SleetSlashSubcommand(
  {
    name: 'default_tags',
    description: 'Add tags to use on every search',
    options: [
      {
        name: 'tags',
        description: 'The tag(s) to add, separated by a space',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      channelOption,
    ],
  },
  {
    run: makeTagModifier(addTags),
  },
)

const removeTagAutocomplete: AutocompleteHandler<string> = makeTagAutocomplete(
  (reference) => settingsCache.getDefaultTags(reference.id),
)

export const configRemoveDefaultTags = new SleetSlashSubcommand(
  {
    name: 'default_tags',
    description: 'Remove tags used on every search',
    options: [
      {
        name: 'tags',
        description: 'The tag(s) to remove, separated by a space',
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: removeTagAutocomplete,
      },
      channelOption,
    ],
  },
  {
    run: makeTagModifier(removeTags),
  },
)

type TagAction = (reference: Reference, tags: string[]) => Promise<void>

function makeTagModifier(tagAction: TagAction) {
  return async (interaction: ChatInputCommandInteraction) => {
    const reference = await getReferenceFor(interaction)
    const tags = getItemsFrom(interaction.options.getString('tags', true))

    if (tags.length === 0) {
      return interaction.reply({
        content: 'You must provide at least one tag',
        flags: MessageFlags.Ephemeral,
      })
    }

    if (tags.some((t) => t.length > 100)) {
      return interaction.reply({
        content: 'Tags must be 100 characters or less',
        flags: MessageFlags.Ephemeral,
      })
    }

    const defer = interaction.deferReply()
    await tagAction(reference, tags)
    await defer

    return await runView(interaction, false)
  }
}

async function addTags(reference: Reference, tags: string[]) {
  await settingsCache.get(reference)

  const tagsToAdd = tags.map((tag) => ({
    referenceId: reference.id,
    name: tag,
  }))

  await prisma.$transaction(
    tagsToAdd.map((data) =>
      prisma.defaultTag.upsert({
        where: {
          referenceId_name: {
            referenceId: data.referenceId,
            name: data.name,
          },
        },
        create: data,
        update: {},
      }),
    ),
  )
}

async function removeTags(reference: Reference, tags: string[]) {
  await prisma.defaultTag.deleteMany({
    where: { referenceId: reference.id, name: { in: tags } },
  })
}
