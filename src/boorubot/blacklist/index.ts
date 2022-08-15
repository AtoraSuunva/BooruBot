import { SleetSlashCommand, SleetSlashCommandGroup } from 'sleetcord'
import { blacklistDelete } from './delete.js'
import { blacklistList } from './list.js'
import { blacklistAddSite, blacklistRemoveSite } from './sites.js'
import { blacklistAddTags, blacklistRemoveTags } from './tag.js'

export const blacklistAdd = new SleetSlashCommandGroup({
  name: 'add',
  description: 'Add a tag or site to the blacklist',
  options: [blacklistAddTags, blacklistAddSite],
})

export const blacklistRemove = new SleetSlashCommandGroup({
  name: 'remove',
  description: 'Remove a tag or site from the blacklist',
  options: [blacklistRemoveTags, blacklistRemoveSite],
})

export const blacklist = new SleetSlashCommand({
  name: 'blacklist',
  description: 'Blacklist tags or sites from being returned by the bot',
  options: [blacklistAdd, blacklistRemove, blacklistList, blacklistDelete],
  default_member_permissions: ['ManageMessages'],
})
