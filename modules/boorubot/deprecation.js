//Issue a deprecation warning if someone uses one of BooruBot's old commands

module.exports.config = {
  name: 'deprecation',
  invokers: ['='],
  help: 'reee old boorubot',
  expandedHelp: 'what are you doing searching help for this stop',
  invisible: true
}

const deprecations = [
  {oldCommand: '=help', newCommand: 'b!help'},
  {oldCommand: '=setting', newCommand: 'b!setting'},
  {oldCommand: '=blacklist', newCommand: 'b!blacklist'},
  {oldCommand: '=whitelist', newCommand: 'b!whitelist'},
  {oldCommand: '=add', newCommand: 'No command anymore...'},
  {oldCommand: '=remove', newCommand: 'No command anymore...'},
  {oldCommand: '=avy', newCommand: 'b!avy'},
  {oldCommand: '=invite', newCommand: 'b!invite'},
  {oldCommand: '=rand', newCommand: 'b!s rand'},
  {oldCommand: '=eval', newCommand: 'atlas pls'}
]

const booru = require('booru')
for (let site of Object.keys(booru.sites)) {
  deprecations.push({oldCommand: `=${site}`, newCommand: `b!s ${site}`})
  for (let alias of booru.sites[site].aliases) deprecations.push({oldCommand: `=${alias}`, newCommand: `b!s ${alias}`})
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  const settingsId = (message.guild !== null) ? message.guild.id : message.channel.id
  const settings = bot.modules.settings.get(settingsId)

  if (!settings.options.deprecationWarning) return;

  for (let deprecation of deprecations) {
    if (message.content.startsWith(deprecation.oldCommand)) message.channel.send(`\`${deprecation.oldCommand}\` is deprecated, use \`${deprecation.newCommand}\` instead.\n*Use \`b!set deprecationWarning false\` to disable this message, \`b!help ${deprecation.newCommand.replace('b!','')}\` for help.*`)
  }
}
