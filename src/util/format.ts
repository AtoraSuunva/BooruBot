import { codeBlock, type Guild } from 'discord.js'
import { notNullish } from 'sleetcord-common'

type Value = string | number | boolean | Date | null | undefined
type Formatter = (value: Value, guild?: Guild) => string

interface FormatConfigOptions<Config extends Record<string, Value>> {
  /** The configuration to format into text */
  config: Config
  /** Formatters for keys */
  formatters?: Partial<Record<keyof Config, Formatter>>
  /** Whether to use the default formatters, for `*<guild|channel|role>_id` keys */
  useDefaultFormatters?: boolean
  /** The guild to use for formatting guild, channel, and role IDs */
  guild?: Guild
  /** Map keys to something else, usually `internalName` => `Display Name` */
  mapKeys?: Partial<Record<keyof Config, string>>
  /** The old configuration to compare to, to show what has changed */
  oldConfig?: Config | null
  /** Keys to omit from the formatted config */
  omit?: (keyof Config)[]
  /** Whether to snake_case the keys */
  snakeCase?: boolean
}

export const guildFormatter: Formatter = (value: Value, guild?: Guild) =>
  `${guild && value === guild.id ? guild.name : 'unknown-guild'} (${String(
    value,
  )})`

export const channelFormatter: Formatter = (value: Value, guild?: Guild) =>
  `#${
    guild?.channels.cache.get(value as string)?.name ?? 'unknown-channel'
  } (${String(value)})`

export const roleFormatter: Formatter = (value: Value, guild?: Guild) =>
  `@${
    guild?.roles.cache.get(value as string)?.name ?? 'unknown-role'
  } (${String(value)})`

const defaultFormatters: Record<string, Formatter> = {
  guild_id: guildFormatter,
  channel_id: channelFormatter,
  role_id: roleFormatter,
}

/**
 * Format a configuration object into a string, with appropriate formatting
 * @param options The options for formatting the config
 * @returns The formatted config, as a string
 */
export function formatConfig<Config extends Record<string, Value>>(
  options: FormatConfigOptions<Config>,
): string {
  const {
    config,
    formatters = {} as NonNullable<FormatConfigOptions<Config>['formatters']>,
    useDefaultFormatters = true,
    guild,
    mapKeys = {} as NonNullable<FormatConfigOptions<Config>['mapKeys']>,
    oldConfig,
    omit = ['guildid', 'updatedat', 'createdat'],
    snakeCase = true,
  } = options

  let longest = 0

  const formatterEntries = Object.entries(defaultFormatters)

  const formatted = Object.entries(config)
    .sort(([key1], [key2]) => key1.localeCompare(key2))
    .filter(([key]) => !omit.includes(key.toLowerCase()))
    .map(([key, value]): [string, Value] => {
      const isNew = oldConfig && oldConfig[key] !== value
      let displayKey = mapKeys[key as keyof Config] ?? key
      displayKey = snakeCase ? toSnakeCase(displayKey) : displayKey
      displayKey = isNew ? `*${displayKey}` : displayKey

      if (displayKey.length > longest) longest = displayKey.length

      value = formatters[key as keyof Config]?.(value, guild) ?? value

      if (useDefaultFormatters && notNullish(value)) {
        for (const [key, formatter] of formatterEntries) {
          if (displayKey.toLowerCase().endsWith(key)) {
            value = formatter(value, guild)
            break
          }
        }
      }

      return [displayKey, value]
    })
    .map(([key, value]) => {
      return `${key.padEnd(longest, ' ')} = ${String(value)}`
    })
    .join('\n')

  return codeBlock('ini', formatted)
}

/**
 * Converts a string from camelCase to snake_case
 * @param str The string to make snake case
 * @returns The snake cased string
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .trim()
}
