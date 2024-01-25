import booru from 'booru'
import {
  APIApplicationCommandBasicOption,
  APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  BaseGuildTextChannel,
  BaseGuildVoiceChannel,
  BaseInteraction,
  ChannelType,
  CommandInteraction,
  Snowflake,
  ThreadOnlyChannel,
  VoiceChannel,
} from 'discord.js'
import { AutocompleteHandler, makeChoices } from 'sleetcord'
import { notNullish } from 'sleetcord-common'
import { BooruSettings, Reference, settingsCache } from './SettingsCache.js'
import { getInteractionChannel } from './search/searchUtils.js'

export const channelOption = {
  name: 'channel',
  description: 'The channel to set the config for',
  type: ApplicationCommandOptionType.Channel,
  channel_types: [
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
    ChannelType.GuildStageVoice,
    ChannelType.GuildText,
    ChannelType.GuildVoice,
  ],
} satisfies APIApplicationCommandBasicOption

/**
 * Get a reference usable to fetch settings for some particular interaction
 * @param interaction The interaction to get a reference for
 * @param checkOptions Whether or not to check the options for a channel
 * @returns A reference item for this interaction, based on the guild or user id
 */
export async function getReferenceFor(
  interaction: BaseInteraction,
  checkOptions = true,
): Promise<Reference> {
  let channel:
    | BaseGuildTextChannel
    | BaseGuildVoiceChannel
    | VoiceChannel
    | ThreadOnlyChannel
    | null = null

  if (checkOptions && interaction.inGuild()) {
    if (interaction.isChatInputCommand()) {
      channel = interaction.options.getChannel(
        channelOption.name,
        false,
        channelOption.channel_types,
      )
    } else if (interaction.isAutocomplete()) {
      const channelValue = interaction.options.get(channelOption.name)?.value

      if (channelValue) {
        const chanOpt = await interaction.client.channels.fetch(
          channelValue as Snowflake,
        )

        if (
          chanOpt &&
          chanOpt.isTextBased() &&
          !chanOpt.isThread() &&
          !chanOpt.isDMBased()
        ) {
          channel = chanOpt
        }
      }
    }
  }

  return {
    id: channel?.id ?? interaction.guild?.id ?? interaction.user.id,
    guildId: interaction.guild?.id ?? null,
    isGuild: channel ? false : interaction.guild !== null,
    allowNSFW: channel ? channel.nsfw : interaction.inGuild(),
  }
}

/**
 * Turns a string of space-separated items into an array of items
 * @param str A space-separated string of items
 * @returns The items in the string as an array, trimmed
 */
export function getItemsFrom(str: string): string[] {
  return str
    .split(/[, \n]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== '')
}

export const siteInfo = Object.values(booru.sites)
type SiteInfo = (typeof siteInfo)[0]

interface SiteListResult {
  name: string
  value: string
  sites: string[]
}

type SiteInfoPredicate = Parameters<SiteInfo[]['filter']>['0']

interface SiteListGetOptions {
  filter?: SiteInfoPredicate
}

type GetSiteList = (opts?: SiteListGetOptions) => SiteListResult

interface NamedSiteList {
  name: string
  // Getter since we potentially might dynamically generate this based on what's currently blacklisted (or not)
  get: GetSiteList
}

/**
 * Not real sites, but "helpful shortcuts" like all sites, all nsfw sites... etc
 */
const siteLists: NamedSiteList[] = [
  {
    name: 'list: all sites',
    get: ({ filter = () => true }: SiteListGetOptions = {}) => {
      const allSites = siteInfo.filter(filter)

      return {
        name: `All Sites (${allSites.length})`,
        value: 'list: all sites',
        sites: allSites.map((s) => s.domain),
      }
    },
  },

  {
    name: 'list: nsfw sites',
    get: ({ filter = () => true }: SiteListGetOptions = {}) => {
      const nsfwSites = siteInfo.filter((s, i, a) => s.nsfw && filter(s, i, a))

      return {
        name: `NSFW Sites (${nsfwSites.length})`,
        value: 'list: nsfw sites',
        sites: nsfwSites.map((s) => s.domain),
      }
    },
  },

  {
    name: 'list: sfw sites',
    get: ({ filter = () => true }: SiteListGetOptions = {}) => {
      const sfwSites = siteInfo.filter((s, i, a) => !s.nsfw && filter(s, i, a))

      return {
        name: `SFW Sites (${sfwSites.length})`,
        value: 'list: sfw sites',
        sites: sfwSites.map((s) => s.domain),
      }
    },
  },
]

/**
 * Try and resolve a string to a site, using the domain + aliases
 * @param value The value to try and resolve a single site (potentially returning multiple matches)
 * @returns The match(es) found, as an array of SiteInfo objects
 */
export function resolveSitesFor(value: string) {
  const lowerValue = value.toLowerCase()

  return siteInfo.filter(
    (info) =>
      info.domain.toLowerCase().includes(lowerValue) ||
      info.aliases.some((alias) => alias.toLowerCase().includes(lowerValue)),
  )
}

/**
 * Try and resolve a string to a list of sites (ie. all sites, all nsfw, all sfw...)
 * @param value The value to try and match against a special list of sites (potentially returning multiple matches)
 * @returns The match(es) found, as an array of SiteListResults
 */
export function resolveListsFor(
  value: string,
  filter: SiteInfoPredicate = () => true,
): SiteListResult[] {
  const lowerValue = value.toLowerCase()

  return siteLists
    .filter((special) => special.name.includes(lowerValue))
    .map((special) => special.get({ filter }))
}

/**
 * Try and resolve a string to a site or list of sites, using domain + aliases for single sites or a special list of sites
 * @param value The value to try and match against a single site or a list of sites (potentially retuning multiple matches)
 * @returns The match(es) found, as an array of SiteListResults
 */
export function resolveSitesAndListsFor(
  value: string,
  filter: SiteInfoPredicate = () => true,
): SiteListResult[] {
  const lowerValue = value.toLowerCase()

  const sites = resolveSitesFor(lowerValue).map((s) => ({
    name: s.domain,
    value: s.domain,
    sites: [s.domain],
  }))

  const lists = resolveListsFor(lowerValue, filter)

  return [...lists, ...sites]
}

export const autocompleteSite: AutocompleteHandler<string> = ({ value }) => {
  return resolveSitesFor(value).map((site) => ({
    name: site.domain,
    value: site.domain,
  }))
}

export const autocompleteSiteOrList: AutocompleteHandler<string> = ({
  value,
}) => {
  return resolveSitesAndListsFor(value).map((opt) => ({
    name: opt.name,
    value: opt.value,
  }))
}

export const siteChoices: APIApplicationCommandOptionChoice<string>[] =
  makeChoices(siteInfo.map((site) => site.domain))

/**
 * Clones an array and then shuffles the clone in-place using Durstenfeld's algorithm
 * @param array The array to clone
 * @returns The array, shuffled
 */
export function shuffleArray<T>(array: T[]): T[] {
  const clone = array.slice()

  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }

  return clone
}

interface MergedSettings {
  guild: BooruSettings
  channel: BooruSettings
  user: BooruSettings
  merged: BooruSettings & { config: { allowNSFW: boolean } }
}

export async function getMergedSettings(
  interaction: CommandInteraction | AutocompleteInteraction,
): Promise<MergedSettings> {
  const reference = await getReferenceFor(interaction)
  const channel = await getInteractionChannel(interaction)
  const userReferenceId = interaction.user.id

  if (channel.isDMBased()) {
    const userSettings = await settingsCache.get({
      id: userReferenceId,
      guildId: null,
      isGuild: false,
      allowNSFW: false,
    })

    return {
      guild: userSettings,
      channel: userSettings,
      user: userSettings,
      merged: {
        config: merge({ allowNSFW: false }, userSettings.config),
        defaultTags: userSettings.defaultTags,
        tags: userSettings.tags,
        sites: userSettings.sites,
      },
    }
  }

  const [guildSettings, channelSettings, userSettings] = await Promise.all([
    settingsCache.get(reference),
    settingsCache.get({
      id: channel.id,
      guildId: reference.isGuild ? reference.id : null,
      isGuild: false,
      allowNSFW: null, // default: pass through to guild setting
    }),
    settingsCache.get({
      id: userReferenceId,
      guildId: null,
      isGuild: false,
      allowNSFW: false, // default: no nsfw in DMs
    }),
  ])

  const merged = {
    config: merge(
      { allowNSFW: interaction.inGuild() },
      guildSettings.config,
      channelSettings.config,
      // User configs only override outside of guilds
      interaction.inGuild() ? {} : userSettings.config,
    ),
    defaultTags: Array.from(
      new Set([
        ...guildSettings.defaultTags,
        ...channelSettings.defaultTags,
        ...userSettings.defaultTags,
      ]),
    ),
    tags: Array.from(
      new Set([
        ...guildSettings.tags,
        ...channelSettings.tags,
        ...userSettings.tags,
      ]),
    ),
    sites: Array.from(
      new Set([
        ...guildSettings.sites,
        ...channelSettings.sites,
        ...userSettings.sites,
      ]),
    ),
  }

  return {
    guild: guildSettings,
    channel: channelSettings,
    user: userSettings,
    merged,
  }
}

type OptionalPropertyNames<T> = {
  [K in keyof T]-?: object extends { [P in K]: T[K] }
    ? K
    : null extends T[K]
      ? K
      : undefined extends T[K]
        ? K
        : never
}[keyof T]

type SpreadProperties<L, R, K extends keyof L & keyof R> = {
  [P in K]: L[P] | Exclude<R[P], undefined | null>
}

type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

type SpreadTwo<L, R> = Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>> &
    Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>> &
    SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>

type Spread<A extends readonly [...unknown[]]> = A extends [infer L, ...infer R]
  ? SpreadTwo<L, Spread<R>>
  : unknown

/**
 * Merge a series of objects, with later values overriding previous values unless they are null or undefined
 * @param objs The objects to merge
 * @returns The merged objects, with null properties not overriding previous properties
 */
function merge<T extends object[]>(...objs: [...T]): Spread<T> {
  return objs.slice(1).reduce((acc, obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (notNullish(value)) {
        acc[key as keyof typeof acc] =
          value as unknown as (typeof acc)[keyof typeof acc]
      }
    }

    return acc
  }) as Spread<T>
}

export async function getMergedSites(
  interaction: CommandInteraction | AutocompleteInteraction,
): Promise<string[]> {
  const reference = await getReferenceFor(interaction)
  const channel = await getInteractionChannel(interaction)
  const userReferenceId = interaction.user.id

  const [guildSites, channelSites, userSites] = await Promise.all([
    settingsCache.getSites(reference.id),
    settingsCache.getSites(channel.id),
    settingsCache.getSites(userReferenceId),
  ])

  return Array.from(new Set([...guildSites, ...channelSites, ...userSites]))
}
