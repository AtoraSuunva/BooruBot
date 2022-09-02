import { SleetSlashCommand } from 'sleetcord'
import { viewBlacklist } from './blacklist.js'
import { viewSites } from './sites.js'

export const view = new SleetSlashCommand({
  name: 'view',
  description: 'View some of the cool lists',
  options: [viewSites, viewBlacklist],
})
