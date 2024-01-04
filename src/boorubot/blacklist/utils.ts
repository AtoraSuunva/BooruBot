import { BaseMessageOptions, bold, escapeCodeBlock } from 'discord.js'
import { prisma } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'

export interface Blacklist {
  referenceId: string
  guildId?: string | null
  isGuild?: boolean
  tags: string[]
  sites: string[]
}

export interface FormatBlacklistOptions {
  highlightTags?: string[]
  highlightSites?: string[]
}

/**
 * Formats a blacklist as a string, then either returning as a string (as message.content) or as a file (as message.files)
 * depending on the character size of the blacklist, so too-long blacklists can actually be sent
 * @param blacklist The blacklist to format
 * @param options Options for formatting the blacklist
 * @returns A message options object that can be sent to Discord
 */
export function formatBlacklist(
  blacklist: Blacklist,
  { highlightTags = [], highlightSites = [] }: FormatBlacklistOptions = {},
): BaseMessageOptions {
  const tags = formatBlacklistArray(blacklist.tags, highlightTags)
  const sites = formatBlacklistArray(blacklist.sites, highlightSites)

  const header = blacklist.isGuild
    ? 'Guild Config'
    : blacklist.guildId
      ? `Channel Config: <#${blacklist.referenceId}>`
      : 'User Config'

  const formatted = `${header}\n\`\`\`yml
Tags:
  - ${tags}

Sites:
  - ${sites}
\`\`\``

  if (formatted.length < 2000) {
    return {
      content: formatted,
    }
  } else {
    return {
      files: [
        {
          name: 'blacklist.txt',
          attachment: Buffer.from(formatted, 'utf-8'),
        },
      ],
    }
  }
}

function formatBlacklistArray(items: string[], highlight: string[]): string {
  if (items.length === 0) {
    return '[Empty]'
  }

  return items
    .map((item) => escapeCodeBlock(item))
    .map((item) => (highlight.includes(item) ? bold(item) : item))
    .join(', ')
}

export async function getBlacklistFor(referenceId: string): Promise<Blacklist> {
  const blacklist = await prisma.booruConfig
    .findFirst({
      where: {
        referenceId,
      },
      select: {
        referenceId: true,
        guildId: true,
        isGuild: true,
        tags: {
          select: {
            name: true,
          },
        },
        sites: {
          select: {
            name: true,
          },
        },
      },
    })
    .then((result) =>
      result
        ? {
            referenceId: result.referenceId,
            guildId: result.guildId,
            isGuild: result.isGuild,
            tags: result.tags.map((tag) => tag.name),
            sites: result.sites.map((site) => site.name),
          }
        : {
            referenceId,
            tags: [],
            sites: [],
          },
    )

  settingsCache.setTags(referenceId, blacklist.tags)
  settingsCache.setSites(referenceId, blacklist.sites)

  return blacklist
}
