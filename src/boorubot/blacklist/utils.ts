import { escapeCodeBlock, bold } from 'discord.js'
import { prisma } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'

export interface Blacklist {
  tags: string[]
  sites: string[]
}

export interface FormatBlacklistOptions {
  highlightTags?: string[]
  highlightSites?: string[]
}

export function formatBlacklist(
  blacklist: Blacklist,
  { highlightTags = [], highlightSites = [] }: FormatBlacklistOptions = {},
): string {
  const tags = formatBlacklistArray(blacklist.tags, highlightTags)
  const sites = formatBlacklistArray(blacklist.sites, highlightSites)

  return `\`\`\`asciidoc
Tags :
======
${tags}

Sites:
======
${sites}
\`\`\``
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
            tags: result.tags.map((tag) => tag.name),
            sites: result.sites.map((site) => site.name),
          }
        : {
            tags: [],
            sites: [],
          },
    )

  settingsCache.setTags(referenceId, blacklist.tags)
  settingsCache.setSites(referenceId, blacklist.sites)

  return blacklist
}
