import { BooruConfig } from '@prisma/client'
import { CommandInteraction } from 'discord.js'
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
