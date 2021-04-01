//Semi-core module? Kills the bot.

module.exports.config = {
  name: 'die',
  invokers: ['die', 'kys', 'do the thing'],
  help: 'Restarts the bot',
  expandedHelp: "Please don't kill me...",
  invisible: true,
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let config = bot.sleet.config
  let modules = bot.sleet

  if (message.author.id === config.owner.id) {
    if (
      message.guild &&
      message.channel.permissionsFor(bot.user).has('SEND_MESSAGES')
    ) {
      message.channel
        .send('no u')
        .then(_ => modules.saveAndExit())
        .catch(err => {
          modules.reportError(err, 'Exit Err')
          message.channel.send(`...I didn't die`)
        })
    } else {
      bot.users.cache
        .get(config.owner.id)
        .send('im ded')
        .then(_ => modules.saveAndExit())
        .catch(err => {
          modules.reportError(err, 'Exit Err')
          bot.users.cache.get(config.owner.id).send(`...I didn't die`)
        })
    }
  }
}
