import {
  type BaseInteraction,
  cleanCodeBlockContent,
  codeBlock,
  type ForumChannel,
  type Guild,
  type InteractionCallbackResponse,
  messageLink,
  type Snowflake,
} from 'discord.js'
import pluralize from 'pluralize'
import { notNullish } from 'sleetcord-common'
import stringWidth from 'string-width'

type Value =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { toString: () => string }
type GuildFormatter<T> = (value: T, guild?: Guild) => string

interface FormatConfigOptions<Config extends Record<string, Value>> {
  /** The configuration to format into text */
  config: Config
  /** Formatters for keys */
  formatters?: { [K in keyof Config]?: GuildFormatter<Config[K]> }
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

export const guildFormatter: GuildFormatter<Value> = (
  value: Value,
  guild?: Guild,
) =>
  `${guild && value === guild.id ? guild.name : 'unknown-guild'} (${String(
    value,
  )})`

export const channelFormatter: GuildFormatter<Value> = (
  value: Value,
  guild?: Guild,
) =>
  `#${
    guild?.channels.cache.get(value as string)?.name ?? 'unknown-channel'
  } (${String(value)})`

export const roleFormatter: GuildFormatter<Value> = (
  value: Value,
  guild?: Guild,
) =>
  `@${
    guild?.roles.cache.get(value as string)?.name ?? 'unknown-role'
  } (${String(value)})`

export const makeForumTagFormatter: (
  forum: ForumChannel,
) => GuildFormatter<Value> = (forum: ForumChannel) => (value: Value) => {
  const tag = forum.availableTags.find((t) => t.id === value)

  if (!tag) {
    return `unknown-tag (${String(value)})`
  }

  return `${tag.emoji?.name ? `${tag.emoji.name} ` : ''}${tag.name} (${String(value)})`
}

const defaultFormatters: Record<string, GuildFormatter<Value>> = {
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

      value =
        formatters[key as keyof Config]?.(
          value as Config[keyof Config],
          guild,
        ) ?? value

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

  return codeBlock('ini', cleanCodeBlockContent(formatted))
}

/**
 * Converts a string from camelCase to snake_case
 * @param str The string to make snake case
 * @returns The snake cased string
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .trim()
}

interface PluralOptions {
  includeCount?: boolean
  boldNumber?: boolean
}

/**
 * A simple wrapper around the npm pluralize package, to include the count by default and to use `toLocaleString` for the count
 * @param str The string to pluralize
 * @param count The count of the string there is
 * @param includeCount Whether to include the count in the string as `<count> string`
 * @returns A pluralized string, depending on the count
 */
export function plural(
  str: string,
  count: number,
  { includeCount = true, boldNumber = true }: PluralOptions = {},
): string {
  let numberFormat = (n: number) => n.toLocaleString()

  if (boldNumber) {
    numberFormat = (num) => `**${num.toLocaleString()}**`
  }

  return `${includeCount ? `${numberFormat(count)} ` : ''}${pluralize(
    str,
    count,
  )}`
}

/**
 * Capitalizes a string from "this" => "This" or "hello world" => "Hello World"
 * @param str The string to capitalize
 * @returns The string, capitalized
 */
export function capitalize(str: string): string {
  return str
    .split(' ')
    .map((s) => s[0].toLocaleUpperCase() + s.slice(1))
    .join(' ')
}

type Formatter<T> = (value: T) => string

export interface TableFormatOptions<T> {
  /** The keys to show, by default all keys of the first object */
  keys?: (keyof T)[]
  /** Formatters for keys */
  formatters?: { [K in keyof T]?: Formatter<T[K]> }
  /** Map column names (taken from keys) to something else, usually `keyName` => `Key Name` */
  columnNames?: Partial<Record<keyof T, string>>
  /** Whether to show "nullish" (null | undefined) values as-is or as empty cells, default true (show as-is) */
  showNullish?: boolean
  /** Truncate the table if it would go over this amount of characters (extra rows are dropped) */
  characterLimit?: number
}

/**
 * Format an array of objects as a markdown table, with the keys (configurable) as the columns
 * and with appropriate padding
 * @param data The data to format
 * @param options Options for formatting
 * @returns A formatted table, as a string
 */
export function tableFormat<T extends Record<string, Value>>(
  data: T[],
  options?: TableFormatOptions<T>,
): string {
  const {
    keys = Object.keys(data[0]),
    columnNames: columnsNames = {} as NonNullable<
      TableFormatOptions<T>['columnNames']
    >,
    showNullish = true,
    characterLimit = Number.POSITIVE_INFINITY,
    formatters = {} as NonNullable<TableFormatOptions<T>['formatters']>,
  } = options ?? {}

  const header: string[] = []
  const separator: string[] = []
  const rows: string[] = []

  // We need to measure the width of the longest row for each column to pad it correctly
  // Unfortunately, there's no easy way to do this without having to iterate over data twice,
  // once to measure and once to format

  // Start off by measuring the longest row for each column. We'll track this in an array storing
  // "longest so far" for each column. i.e. [key]: [headerLength, longestRowByRow1, longestRowByRow2, ...]
  // So if the key "name" has a header length of 10, then row lengths of 3, 15, 5 would be stored as:
  // [key]: [10, 10, 15, 15]
  // This allows us to truncate rows once we hit the character limit and then format previous rows without extra spacing

  /**
   * Measures the required width for each column, per row. Index 0 is the length required to print the header.
   * Indexes 1, 2, 3... are the lengths required to print 1, 2, 3... rows of data
   *
   * For example, given the data:
   *
   * ```
   * key  | foo
   * a    | bar
   * bbbb | bar
   * ccc  | bar
   * ```
   *
   * `rollingLongestRow` would look something like this:
   * ```ts
   * {
   *   key: [
   *     3, // 3 characters required for the header "key"
   *     3, // "a" only requires 1 character, but we would need 3 for all columns to align, so we need 3
   *     4, // "bbbb" requires 4, which is > 3
   *     4, // "ccc" requires 3, which is < 4
   *   ],
   *   foo: [...],
   * }
   * ```
   *
   * This allows you to quickly determine how much padding you would need if you wanted to print up to row i
   * without having to re-measure all previous rows. i.e. if you wanted to print headers + 1 row of data then
   * you would need `rollingLongestRow['key'][1] === 3` characters for the "key" column. If you wanted to print
   * 3 rows you would need `rollingLongestRow['key'][3] === 4` characters for the "key" column.
   */
  const rollingLongestRow = Object.fromEntries(
    keys.map((key) => [key, [] as number[]]),
  ) as Record<keyof T, number[]>

  /**
   * Measures the total length required to print a row, including the separators. Index 0 are the headers,
   * Indexes 1, 2, 3... are the lengths required to print 1, 2, 3... rows of data. The length uses the
   * `rollingLongestRow` values so `rowTotalLength[3]` would be the length required for the headers and for
   * *every* row of data for the 3 first rows of data.
   */
  const rowTotalLength: number[] = []

  /** The ` │ ` separators between columns need to be considered when measuring character count */
  const separatorLength = (keys.length - 1) * 3

  // Measure the headers
  let currentHeaderLength = 0
  for (const key of keys) {
    const name = columnsNames[key] ?? key
    const keyLength = stringWidth(String(name))
    rollingLongestRow[key].push(keyLength)
    currentHeaderLength += keyLength
  }

  rowTotalLength.push(currentHeaderLength + separatorLength)

  // Measure the rows
  for (const row of data) {
    let currentRowLength = 0

    for (const key of keys) {
      const formatter = formatters[key] ?? String
      const formatted = formatter(row[key])

      const longestLength = Math.max(
        stringWidth(formatted),
        rollingLongestRow[key][rollingLongestRow[key].length - 1],
      )

      rollingLongestRow[key].push(longestLength)
      currentRowLength += longestLength + separatorLength
    }

    rowTotalLength.push(currentRowLength)
  }

  // Now check how many rows we can print before hitting the character limit
  let printedLength = rowTotalLength[0] * 2 // Header + separator row
  let printRows = 0

  if (characterLimit === Number.POSITIVE_INFINITY) {
    printRows = rowTotalLength.length
  } else {
    for (let i = 1; i < rowTotalLength.length; i++) {
      printedLength += rowTotalLength[i]
      if (printedLength > characterLimit) break
      printRows = i
    }
  }

  if (printRows === 0) {
    return '<table too large to display any rows>'
  }

  // Print the headers

  const measureIndex = printRows - 1

  for (const key of keys) {
    const name: string = columnsNames[key] ?? String(key)
    const longest = rollingLongestRow[key][measureIndex] ?? 0
    header.push(name.padEnd(longest, ' '))
    separator.push('─'.repeat(longest))
  }

  const joinedHeader = header.join(' │ ')
  const joinedSeparator = separator.join('─┼─')

  const head = `${joinedHeader}\n${joinedSeparator}\n`

  for (let i = 0; i < printRows; i++) {
    const row = data[i]
    const formattedRow = keys
      .map((k) => {
        let value: T[keyof T] = row[k]

        if (!showNullish && (value === null || value === undefined)) {
          value = '' as T[keyof T]
        }

        const format = formatters[k] ?? String

        return padEndTo(format(value), rollingLongestRow[k][measureIndex])
      })
      .join(' │ ')

    rows.push(formattedRow)
  }

  const removed =
    rows.length < data.length
      ? `\nTruncated ${plural('row', data.length - rows.length, { boldNumber: false })}.`
      : ''

  return `${head}${rows.join('\n')}${removed}`.substring(0, characterLimit)
}

function padEndTo(str: string, length: number, character = ' '): string {
  const offset = str.length - stringWidth(str)

  return str.padEnd(length + offset, character)
}

export function responseMessageLink(
  interaction: BaseInteraction & { channelId: Snowflake },
  response: InteractionCallbackResponse,
) {
  if (!response.interaction.responseMessageId) {
    return '<missing response message id>'
  }

  return interaction.inGuild()
    ? messageLink(
        interaction.channelId,
        response.interaction.responseMessageId,
        interaction.guildId,
      )
    : messageLink(interaction.channelId, response.interaction.responseMessageId)
}
