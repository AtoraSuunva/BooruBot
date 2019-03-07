//Core module, allows you to edit the invokers on the fly

module.exports.config = {
  name: 'invoker',
  invokers: ['invoker', 'invokers'],
  help: 'Add/remove invokers on the fly',
  expandedHelp: '`invoker [add|rm|save] invoker`\nAdd/remove invokers on the fly\nChanges aren\'t saved unless you use "invoker save" and will reset when the bot shutsdown',
  usage: ['View invokers', 'invoker', 'Add invoker', 'invoker add new', 'Remove invoker', 'invoker rm new', 'Save invokers', 'invoker save'],
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let shlex = bot.sleet.shlex
  let config = bot.sleet.config

  let args = shlex(message.content)

  if (message.author.id !== config.owner.id && args[1] === undefined) return

  switch (args[1]) {
    case 'add':
      if (args[2] === undefined) break
      config.invokers.push(args[2])
      config.invokers = Array.from(new Set(config.invokers)) //some magic to ensure there's no duplicate invokers
      bot.sleet.reloadConfig(config)
      message.channel.send(`Added \`${args[2]}\`\nCurrent invokers are \`${config.invokers.join('\`, \`')}\``)
      return
    break

    case 'remove':
    case 'rm':
      if (args[2] === undefined || config.invokers.indexOf(args[2]) === -1) break
      if (config.invokers.length === 1) {
        message.channel.send('You need at least one invoker you dip!')
        return
      }
      config.invokers.splice(config.invokers.indexOf(args[2]), 1)
      bot.sleet.reloadConfig(config)
      message.channel.send(`Removed \`${args[2]}\`\nCurrent invokers are \`${config.invokers.join('\`, \`')}\``)
      return
    break

    case 'save':
      require('fs').writeFile('./config.json', JSON.stringify(config, null, 4), (err) => {
        if (err) throw err;
        bot.sleet.logger.log('Updated Config.json!')
        message.channel.send(`Saved config!`)
      })
      return
    break
  }
  message.channel.send(`Current invokers are: \`${config.invokers.join('\`, \`')}\``)
}
