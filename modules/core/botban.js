//Bans a user from using the bot

module.exports.config = {
  name: 'botban',
  invokers: ['botban', 'don\'t talk to me or my bot ever again', 'unbotban'],
  help: 'botbans people',
  expandedHelp: 'Botbans people. `botban [@mention | ID]\nalso why are you searching help for this only the owner can use this`',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let config = bot.modules.config
  let args = bot.modules.shlex(message.content.replace('don\'t talk to me or my bot ever again', 'botban'))


  if (message.author.id !== config.owner.id) return message.channel.send('no.')

  if (args[1] === undefined) return message.author.send(config.botbans.map(b=>`**${b.name}**#${b.discriminator} (${b.id}): ${b.reason}`).join('\n')||'No botbans.')

  let user = (message.mentions.users.first()) ? message.mentions.users.first().id : args[1]

  if (user === config.owner.id) return message.channel.send(`That's a bad idea...`)
  if (user === bot.user.id) return message.channel.send(`What would that even accomplish`)

  //unbotban id/name/discriminator thething


  bot.fetchUser(user).then(user => {
    let msg = ''
    if (args[0] === 'botban') {
      config.botbans.push({name: user.username, discriminator: user.discriminator, id: user.id, reason: args.splice(2).join(' ')})
      msg = `Botbanned ${user.username}.`
    } else {
      config.botbans = config.botbans.filter(b=>b[args[1]] !== args[2])
      msg = `Unbotbanned ${user.username}.`
    }

    bot.modules.reloadConfig(config)
    bot.modules.saveConfig()
      .then(message.channel.send(msg))
  }).catch(e => {
    bot.modules.logger.log(e)
    message.channel.send('Something went wrong...')
  })
}
