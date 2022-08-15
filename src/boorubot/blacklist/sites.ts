import booru from 'booru'
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { AutocompleteHandler, SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { ensureConfigFor, getReferenceIdFor } from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

const siteInfo = Object.values(booru.sites)

function getMatchingSitesFor(value: string) {
  const lowerValue = value.toLowerCase()
  return siteInfo.filter(
    (site) =>
      site.domain.toLowerCase().includes(lowerValue) ||
      site.aliases.some((alias) => alias.toLowerCase().includes(lowerValue)),
  )
}

const autocompleteSite: AutocompleteHandler<string> = ({ value }) => {
  return getMatchingSitesFor(value).map((site) => ({
    name: site.domain,
    value: site.domain,
  }))
}

export const blacklistAddSite = new SleetSlashSubcommand(
  {
    name: 'site',
    description: 'Add a site to the blacklist',
    options: [
      {
        name: 'site',
        description: 'The site to add',
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteSite,
        required: true,
      },
    ],
  },
  {
    run: makeSiteAction(addSites),
  },
)

export const blacklistRemoveSite = new SleetSlashSubcommand(
  {
    name: 'site',
    description: 'Remove a site from the blacklist',
    options: [
      {
        name: 'site',
        description: 'The site to remove',
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteSite,
        required: true,
      },
    ],
  },
  {
    run: makeSiteAction(removeSites),
  },
)

type SiteAction = (referenceId: string, sites: string[]) => Promise<void>

function makeSiteAction(siteAction: SiteAction) {
  return async function (interaction: ChatInputCommandInteraction) {
    const referenceId = getReferenceIdFor(interaction)
    const sites = getMatchingSitesFor(
      interaction.options.getString('site', true),
    )

    if (sites.length !== 1) {
      return interaction.reply({
        content: "Couldn't resolve a single site, try using the autocomplete",
        ephemeral: true,
      })
    }

    const site = sites[0].domain

    const defer = interaction.deferReply()
    await siteAction(referenceId, [site])
    await defer

    const formattedBlacklist = formatBlacklist(
      await getBlacklistFor(referenceId),
      {
        highlightSites: [site],
      },
    )

    return interaction.editReply(formattedBlacklist)
  }
}

async function addSites(referenceId: string, sites: string[]) {
  await ensureConfigFor(referenceId)

  // TODO: createMany on non-SQLite
  const sitesToAdd = sites.map((site) => ({
    referenceId,
    name: site,
  }))

  for (const site of sitesToAdd) {
    await database.site.upsert({
      where: { referenceId_name: site },
      create: site,
      update: site,
    })
  }
}

async function removeSites(referenceId: string, sites: string[]) {
  await ensureConfigFor(referenceId)

  await database.site.deleteMany({
    where: { name: { in: sites } },
  })
}
