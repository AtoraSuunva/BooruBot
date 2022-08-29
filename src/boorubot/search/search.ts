import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { AutocompleteHandler, SleetSlashCommand } from 'sleetcord'
import { getMatchingSitesFor, getReferenceIdFor, siteInfo } from '../utils.js'
import { settingsCache } from '../SettingsCache.js'
import {
  RANDOM_BOORU_SITE,
  RANDOM_BOORU_VALUE,
  runBooruSearch,
} from './searchImplementation.js'

const autocompleteSiteWithBlacklist: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  const referenceId = getReferenceIdFor(interaction)
  const userReferenceId = interaction.user.id
  const [settings, userSettings] = await Promise.all([
    settingsCache.get(referenceId),
    settingsCache.get(userReferenceId),
  ])

  const blacklistedSites = [...settings.sites, ...userSettings.sites]

  const sites = getMatchingSitesFor(value)
    .filter((site) => !blacklistedSites.includes(site.domain))
    .map((site) => ({
      name: site.domain,
      value: site.domain,
    }))

  if (siteInfo.length - blacklistedSites.length > 1) {
    sites.push({
      name: RANDOM_BOORU_VALUE,
      value: RANDOM_BOORU_VALUE,
    })
  }

  return sites
}

export const search = new SleetSlashCommand(
  {
    name: 'search',
    description: 'Search a booru for posts',
    options: [
      {
        name: 'booru',
        description: 'The booru to search',
        required: true,
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteSiteWithBlacklist,
      },
      {
        name: 'tags',
        description: 'The tags to search for, space-separated (Default: none)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'ephemeral',
        description: 'Send a reply only you can see (Default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runSearch,
  },
)

async function runSearch(interaction: ChatInputCommandInteraction) {
  const booruOption = interaction.options.getString('booru', true)
  const sites = getMatchingSitesFor(booruOption)

  if (sites.length !== 1 && booruOption !== RANDOM_BOORU_VALUE) {
    interaction.reply({
      content: 'Could not find a single matching booru.',
    })
    return
  }

  // Get options
  const site = booruOption === RANDOM_BOORU_VALUE ? RANDOM_BOORU_SITE : sites[0]
  const tags = (interaction.options.getString('tags') ?? '').split(' ')
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  runBooruSearch(interaction, {
    site,
    tags,
    ephemeral,
  })
}
