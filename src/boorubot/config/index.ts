import { SleetSlashCommand, SleetSlashCommandGroup } from 'sleetcord'
import { configAddDefaultTags, configRemoveDefaultTags } from './defaultTags.js'
import { configDelete } from './delete.js'
import { configSet } from './set.js'
import { configView } from './view.js'

export const configAdd = new SleetSlashCommandGroup({
  name: 'add',
  description: 'Add something to the config',
  options: [configAddDefaultTags],
})

export const configRemove = new SleetSlashCommandGroup({
  name: 'remove',
  description: 'Remove something from the config',
  options: [configRemoveDefaultTags],
})

export const config = new SleetSlashCommand({
  name: 'config',
  description: 'Configure the bot',
  default_member_permissions: ['ManageMessages'],
  options: [configView, configSet, configDelete, configAdd, configRemove],
})
