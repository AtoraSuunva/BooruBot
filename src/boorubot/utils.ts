import { BooruConfig } from '@prisma/client'
import { bold, CommandInteraction, escapeCodeBlock } from 'discord.js'
import { database } from '../util/db.js'

export function getReferenceIdFor(interaction: CommandInteraction): string {
  return interaction.guild?.id || interaction.user.id
}

export async function ensureConfigFor(
  referenceId: string,
): Promise<BooruConfig> {
  const config = await database.booruConfig.findUnique({
    where: {
      referenceId,
    },
  })

  if (config !== null) {
    return config
  }

  return database.booruConfig.create({
    data: {
      referenceId,
    },
  })
}

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

export function getBlacklistFor(referenceId: string): Promise<Blacklist> {
  return database.booruConfig
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
}

/**
 * Turns a string of comma-separated items into an array of items
 * @param commaString A comma-separated string of items
 * @returns The items in the string as an array, trimmed
 */
export function getItemsFrom(commaString: string): string[] {
  return commaString
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
}
