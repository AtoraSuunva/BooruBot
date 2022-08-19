import { BooruConfig } from '@prisma/client'
import { BaseInteraction } from 'discord.js'
import { database } from '../util/db.js'
import booru from 'booru'
import { AutocompleteHandler, makeChoices } from 'sleetcord'

export function getReferenceIdFor(interaction: BaseInteraction): string {
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

const siteInfo = Object.values(booru.sites)

export function getMatchingSitesFor(value: string) {
  const lowerValue = value.toLowerCase()
  return siteInfo.filter(
    (site) =>
      site.domain.toLowerCase().includes(lowerValue) ||
      site.aliases.some((alias) => alias.toLowerCase().includes(lowerValue)),
  )
}

export const autocompleteSite: AutocompleteHandler<string> = ({ value }) => {
  return getMatchingSitesFor(value).map((site) => ({
    name: site.domain,
    value: site.domain,
  }))
}

export const siteChoices = makeChoices(siteInfo.map((site) => site.domain))
