//site list link
module.exports.config = {
  name: 'sites',
  invokers: ['sites'],
  help: 'List all the sites BooruBot supports',
  expandedHelp: 'Just use `b!sites`...'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  message.channel.send(`All supported sites: <https://github.com/AtlasTheBot/Booru-Discord/blob/master/sites.md>`)
}
