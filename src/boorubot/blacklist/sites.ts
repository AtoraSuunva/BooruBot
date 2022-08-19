import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'
import { database } from '../../util/db.js'
import { settingsCache } from '../SettingsCache.js'
import {
  autocompleteSite,
  ensureConfigFor,
  getMatchingSitesFor,
  getReferenceIdFor,
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

  settingsCache.deleteSites(referenceId)
}

async function removeSites(referenceId: string, sites: string[]) {
  await ensureConfigFor(referenceId)

  await database.site.deleteMany({
    where: { name: { in: sites } },
  })

  settingsCache.deleteSites(referenceId)
}
