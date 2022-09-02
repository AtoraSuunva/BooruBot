import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import {
  ensureConfigFor,
  getReferenceIdFor,
  autocompleteSiteOrList,
  resolveSitesAndListsFor,
} from '../utils.js'
import { formatBlacklist, getBlacklistFor } from './utils.js'

export const blacklistAddSite = new SleetSlashSubcommand(
  {
    name: 'site',
    description: 'Add a site to the blacklist',
    options: [
      {
        name: 'site',
        description: 'The site to add',
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteSiteOrList,
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
        autocomplete: autocompleteSiteOrList,
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
    const sites = resolveSitesAndListsFor(
      interaction.options.getString('site', true),
    )

    if (sites.length < 1) {
      return interaction.reply({
        content: "Couldn't resolve a single site, try using the autocomplete",
        ephemeral: true,
      })
    }

    const flatSites = sites.flatMap((s) => s.sites)

    const defer = interaction.deferReply()
    await siteAction(referenceId, flatSites)
    await defer

    const formattedBlacklist = formatBlacklist(
      await getBlacklistFor(referenceId),
      {
        highlightSites: flatSites,
      },
    )

    return interaction.editReply(formattedBlacklist)
  }
}

async function addSites(referenceId: string, sites: string[]) {
  await ensureConfigFor(referenceId)

  const sitesToAdd = sites.map((site) => ({
    referenceId,
    name: site,
  }))

  await database.site.createMany({
    data: sitesToAdd,
    skipDuplicates: true,
  })

  settingsCache.deleteSites(referenceId)
}

async function removeSites(referenceId: string, sites: string[]) {
  await ensureConfigFor(referenceId)

  await database.site.deleteMany({
    where: { name: { in: sites } },
  })

  settingsCache.deleteSites(referenceId)
}
