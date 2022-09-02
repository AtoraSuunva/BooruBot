import { SleetSlashCommand } from 'sleetcord'
import { configDelete } from './delete.js'
import { configSet } from './set.js'
import { configView } from './view.js'

export const config = new SleetSlashCommand({
  name: 'config',
  description: 'Configure the bot',
  default_member_permissions: ['ManageMessages'],
  options: [configView, configSet, configDelete],
})
