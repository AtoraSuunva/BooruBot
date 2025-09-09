import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  type APIApplicationEmoji,
  type APIUser,
  type ApplicationEmojiCreateOptions,
  REST,
  Routes,
} from 'discord.js'
import env from 'env-var'
import filetype from 'magic-bytes.js'
import murmur from 'murmurhash'
import { baseLogger } from 'sleetcord-common'
import { prisma } from './db.js'

/** Map of { emojiName: './path/to/image.png' | Buffer } */
type CreateEmojis = Record<string, ApplicationEmojiCreateOptions['attachment']>
type EmojiRecord = Record<string, WrappedApplicationEmoji>

type MapToEmoji<T> = {
  [K in keyof T]: T[K] extends string ? WrappedApplicationEmoji : never
}

interface IApplicationEmoji extends APIApplicationEmoji {}

/**
 * A wrapper class for API Application Emojis.
 *
 * All this does is add a `toString` method to format the emoji as a Discord emoji string.
 */
class WrappedApplicationEmoji implements IApplicationEmoji {
  id: string
  name: string
  animated: boolean
  available: true
  user: APIUser
  roles: []
  require_colons: true
  managed: false

  constructor(emoji: APIApplicationEmoji) {
    this.id = emoji.id
    this.name = emoji.name
    this.animated = emoji.animated
    this.available = emoji.available
    this.user = emoji.user
    this.roles = emoji.roles || []
    this.require_colons = true
    this.managed = false
  }

  toString() {
    return `<:${this.name}:${this.id}>`
  }
}

const TOKEN = env.get('TOKEN').required().asString()
const APPLICATION_ID = env.get('APPLICATION_ID').required().asString()

const rest = new REST({ version: '10' }).setToken(TOKEN)

const syncLogger = baseLogger.child({
  module: 'syncApplicationEmojis',
})

function invalidEmojiNames(names: string[]) {
  return names.filter((name) => !name.match(/^[a-zA-Z0-9_]{2,32}$/))
}

/**
 * Synchronizes application emojis between Discord, a local database, and a provided emoji map.
 *
 * This function ensures that the set of emojis for a given module matches the provided `emojis` map.
 * It will:
 * - Delete emojis from Discord and the database if they exist in the database but not in the new emoji map.
 * - Create new emojis on Discord and in the database if they are present in the emoji map but not in the database.
 * - Update emojis if the image (attachment) has changed, determined by a hash comparison.
 * - Return a mapping of emoji names to their corresponding Discord ApplicationEmoji objects.
 *
 * @template T A record mapping emoji names to file paths or attachments.
 * @param client The Discord client application instance.
 * @param module The module name to scope the emoji synchronization.
 * @param emojis A record of emoji names to file paths or attachments to sync.
 * @returns A promise that resolves to a mapping of emoji names to their corresponding ApplicationEmoji objects.
 */
export async function syncApplicationEmojis<const T extends CreateEmojis>(
  module: string,
  emojis: T,
): Promise<MapToEmoji<T>> {
  const emojiNames = Object.keys(emojis)

  if (emojiNames.length === 0) {
    syncLogger.info(`No emojis to sync for module "${module}".`)
    return {} as MapToEmoji<T>
  }

  const invalidNames = invalidEmojiNames(emojiNames)

  if (invalidNames.length > 0) {
    throw new Error(
      `"${module}" has invalid emoji names: ${invalidNames.join(', ')}. Emoji names must be 2-32 characters long and can only contain alphanumeric characters and underscores.`,
    )
  }

  const { items: discordEmojis } = await fetchEmojis()
  const databaseEmojis = await prisma.applicationEmoji.findMany({
    where: { module },
  })

  const discordEmojiMap = new Map(
    // Names for app emojis are unique, so we can use them as keys
    discordEmojis.map((emoji) => [emoji.name, emoji]),
  )

  // Find emojis that are in the database, not in the new emojis, and on Discord
  const toDelete = databaseEmojis.filter((emoji) => {
    // Not in the new emojis
    if (emojis[emoji.name]) {
      return false
    }

    // On Discord
    return discordEmojiMap.get(emoji.name)
  })

  if (toDelete.length > 0) {
    syncLogger.info(
      `Deleting emojis for module "${module}": ${toDelete.map((emoji) => emoji.name).join(', ')}`,
    )
    // Delete them from Discord
    for (const emoji of toDelete) {
      await deleteEmoji(emoji.id).catch(() => {})
    }

    // Delete them from the database
    await prisma.applicationEmoji.deleteMany({
      where: { id: { in: toDelete.map((emoji) => emoji.id) } },
    })
  }

  const appEmojis: EmojiRecord = {}

  // Create or update emojis
  for (const [name, attachment] of Object.entries(emojis)) {
    // Check if the emoji already exists in the database
    const existingEmoji = databaseEmojis.find((emoji) => emoji.name === name)
    const discordEmoji = discordEmojiMap.get(name)

    // Emoji exists in the database and on Discord
    if (existingEmoji && discordEmoji) {
      // Check if the emoji is updated by computing the murmur3 hash
      const hash = await hashAttachment(attachment)

      if (hash === existingEmoji.hash) {
        // Emoji is up-to-date, skip
        appEmojis[name] = new WrappedApplicationEmoji(discordEmoji)
        continue
      }

      // Emoji is outdated, delete it from Discord and the database, update it at discord, then update the database
      syncLogger.info(
        `Updating emoji "${name}" for module "${module}" due to hash mismatch.`,
      )

      // Delete the emoji from Discord
      await deleteEmoji(existingEmoji.id)

      await prisma.applicationEmoji.delete({
        where: { id: existingEmoji.id },
      })

      const newEmoji = await createEmoji(module, { name, attachment })
      appEmojis[name] = new WrappedApplicationEmoji(newEmoji)
      continue
    }

    // Emoji exists on Discord but not in the database
    if (!existingEmoji && discordEmoji) {
      syncLogger.info(
        `Emoji "${name}" exists on Discord but not in the database, deleting it from Discord and recreating it.`,
      )
      await deleteEmoji(discordEmoji.id).catch(() => {})
    }

    // Emoji does not exist in the database or is not on Discord, create it
    syncLogger.info(`Creating emoji "${name}" for module "${module}".`)
    const newEmoji = await createEmoji(module, { name, attachment })
    appEmojis[name] = new WrappedApplicationEmoji(newEmoji)
  }

  return appEmojis as MapToEmoji<T>
}

function fetchEmojis() {
  return rest.get(Routes.applicationEmojis(APPLICATION_ID)) as Promise<{
    items: APIApplicationEmoji[]
  }>
}

function deleteEmoji(emojiId: string) {
  return rest.delete(
    Routes.applicationEmoji(APPLICATION_ID, emojiId),
  ) as Promise<void>
}

async function createEmoji(
  module: string,
  options: ApplicationEmojiCreateOptions,
) {
  const file = await resolveFile(options.attachment)
  const mime = filetype.filetypemime(file).pop()

  if (!mime || !mime.startsWith('image/')) {
    throw new Error(
      `Attachment "${options.attachment}" is not a valid image file.`,
    )
  }

  const newEmoji = (await rest.post(Routes.applicationEmojis(APPLICATION_ID), {
    body: {
      name: options.name,
      image: resolveBase64(file, mime),
    },
  })) as APIApplicationEmoji

  await prisma.applicationEmoji.create({
    data: {
      id: newEmoji.id,
      name: newEmoji.name,
      hash: await hashAttachment(file),
      module,
    },
  })

  return newEmoji
}

async function resolveFile(
  attachment: string | Buffer<ArrayBufferLike>,
): Promise<Buffer> {
  if (Buffer.isBuffer(attachment)) {
    return attachment
  }

  const path = resolve(attachment)
  const stats = await stat(path)
  if (!stats.isFile()) {
    throw new Error(`Attachment "${path}" is not a file.`)
  }
  const file = await readFile(path)

  return file
}

function resolveBase64(
  attachment: string | Buffer<ArrayBufferLike>,
  contentType = 'image/png',
): string {
  if (Buffer.isBuffer(attachment)) {
    return `data:${contentType};base64,${attachment.toString('base64')}`
  }

  return attachment
}

async function hashAttachment(attachment: string | Buffer<ArrayBufferLike>) {
  const file =
    typeof attachment === 'string' ? await readFile(attachment) : attachment
  return murmur(new Uint8Array(file))
}
