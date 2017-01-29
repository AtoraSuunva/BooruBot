//Bans a user from using the bot

module.exports.config = {
  name: 'botban',
  invokers: ['botban', 'don\'t talk to me or my bot ever again'],
  help: 'botbans people',
  expandedHelp: 'Botbans people. `botban [@mention | ID]\nalso why are you searching help for this only the owner can use this`',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let config = bot.modules.config
  let args = bot.modules.shlex(message.content.replace('don\'t talk to me or my bot ever again', 'donot'))


  if (message.author.id === config.owner.id) {
    let userToBan = (message.mentions.users.first()) ? message.mentions.users.first().id : args[1]

    if (userToBan === config.owner.id) return message.channel.sendMessage(`That's a bad idea...`)
    if (userToBan === bot.user.id) return message.channel.sendMessage(`What would this even accomplish smh`)

    bot.fetchUser(userToBan).then(user => {
      message.channel.sendMessage(`Botbanned ${user.username}.`)
    }).catch(e => {
      message.channel.sendMessage(`Something went wrong...`)
    })
  } else {
    message.channel.sendMessage('no.')
  }
}
