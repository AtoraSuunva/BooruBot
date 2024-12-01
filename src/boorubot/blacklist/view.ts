import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { notNullish } from 'sleetcord-common'
import { getInteractionChannel } from '../search/searchUtils.js'
import { getReferenceFor } from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

export const blacklistView = new SleetSlashSubcommand(
  {
    name: 'view',
    description: 'View the tags and sites in the blacklist',
    options: [
      {
        name: 'ephemeral',
        description:
          'Reply with a public post everyone can see (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runView,
  },
)

export async function runView(interaction: ChatInputCommandInteraction) {
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false
  const reference = await getReferenceFor(interaction)
  const channel = reference.isGuild
    ? await getInteractionChannel(interaction)
    : null

  const blacklists = await Promise.all([
    getBlacklistFor(reference.id),
    channel ? getBlacklistFor(channel.id) : null,
  ])

  const formattedBlacklists = blacklists
    .filter(notNullish)
    .map((b) => formatBlacklist(b))
    .reduce((prev, current) => {
      if (current.content) {
        prev.content = `${prev.content ?? ''}\n${current.content}`
      }

      if (current.files) {
        prev.files = (prev.files ?? []).concat(current.files)
      }

      return prev
    }, {})

  if (!formattedBlacklists.content && !formattedBlacklists.files) {
    return interaction.reply({
      content: 'No blacklist found.',
      ephemeral,
    })
  }

  const reply: InteractionReplyOptions = {}

  if (
    formattedBlacklists.content &&
    formattedBlacklists.content.length > 2000
  ) {
    reply.files = [
      ...(formattedBlacklists.files ?? []),
      {
        name: 'blacklist.txt',
        attachment: Buffer.from(formattedBlacklists.content),
      },
    ]
  } else {
    reply.content = formattedBlacklists.content ?? ''
    reply.files = formattedBlacklists.files ?? []
  }

  return interaction.reply({
    ...reply,
    ephemeral,
  })
}
