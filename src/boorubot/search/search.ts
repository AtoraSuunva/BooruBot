import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { AutocompleteHandler, SleetSlashCommand } from 'sleetcord'
import { getMergedSettings, resolveSitesFor, siteInfo } from '../utils.js'
import {
  RANDOM_BOORU_SITE,
  RANDOM_BOORU_VALUE,
  runBooruSearch,
} from './searchImplementation.js'

const autocompleteSiteWithBlacklist: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  const settings = await getMergedSettings(interaction)

  const blacklistedSites = settings.merged.sites

  const sites = resolveSitesFor(value)
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
  const sites = resolveSitesFor(booruOption)

  if (sites.length !== 1 && booruOption !== RANDOM_BOORU_VALUE) {
    return interaction.reply({
      content: 'Could not find a single matching booru.',
    })
  }

  // Get options
  const site = booruOption === RANDOM_BOORU_VALUE ? RANDOM_BOORU_SITE : sites[0]
  const tags = interaction.options.getString('tags')?.split(' ') ?? []
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  return runBooruSearch(interaction, {
    site,
    tags,
    ephemeral,
  })
}
