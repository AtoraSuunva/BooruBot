import booru from 'booru'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { runBooruSearch } from './search/searchImplementation.js'

const { sites } = booru

interface SiteIdDataInPath {
  type: 'url'
  path: string
}

interface SiteIdDataInQuery {
  type: 'query'
  query: string
}

type SiteIdData = SiteIdDataInPath | SiteIdDataInQuery

const siteFormats: Record<string, SiteIdData> = Object.fromEntries<SiteIdData>(
  Object.entries(Object.assign({}, sites)).map(([domain, info]) => {
    if (info.api.postView.includes('?')) {
      return [
        domain,
        {
          type: 'query',
          // ie. 'https://domain.com/index.php?page=post&v=view&id=' -> 'id'
          query: info.api.postView.split('&').pop()?.slice(0, -1) ?? 'id',
        },
      ]
    }

    return [
      domain,
      {
        type: 'url',
        // ie. /view/post/
        path: info.api.postView,
      },
    ]
  }),
)

export const link = new SleetSlashCommand(
  {
    name: 'link',
    description: 'Use a link to a post to create an embed',
    options: [
      {
        name: 'url',
        description: 'A URL to the post to link',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'ephemeral',
        description: 'Send a reply only you can see (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runLink,
  },
)

function runLink(interaction: ChatInputCommandInteraction) {
  const url = interaction.options.getString('url', true)
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  let parsedUrl: URL | null = null

  try {
    parsedUrl = new URL(url)
  } catch {
    return interaction.reply({
      content: 'Failed to parse url, did you enter a valid url?',
      flags: MessageFlags.Ephemeral,
    })
  }

  if (!(parsedUrl.hostname in siteFormats)) {
    return interaction.reply({
      content: 'That is not a recognized site, did you enter the right url?',
      flags: MessageFlags.Ephemeral,
    })
  }

  const format = siteFormats[parsedUrl.hostname]

  const id =
    format.type === 'url'
      ? getIdInPath(parsedUrl, format)
      : getIdInQuery(parsedUrl, format)

  if (!isInteger(id)) {
    return interaction.reply({
      content:
        'Failed to parse a post ID from that url, did you enter the right url?',
      flags: MessageFlags.Ephemeral,
    })
  }

  return runBooruSearch(interaction, {
    site: {
      domain: parsedUrl.hostname,
    },
    tags: [`id:${id}`],
    ephemeral,
  })
}

function getIdInPath(url: URL, idData: SiteIdDataInPath): string {
  const { pathname } = url
  return pathname.slice(idData.path.length)
}

function getIdInQuery(url: URL, idData: SiteIdDataInQuery): string {
  return url.searchParams.get(idData.query) ?? ''
}

const intRegex = /^\d+$/

function isInteger(str: string): boolean {
  return intRegex.test(str)
}
