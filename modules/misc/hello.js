//Here's another, minimal example

module.exports.config = {
  name: 'hello',
  invokers: ['hello', 'h'],
  help: 'Says hi!',
  expandedHelp: 'It says hi. That\'s it. I wish it did my taxes though.',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let settings = bot.modules.settings
  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id

  if (message.guild === null) { //It's a DM, time to check `disableDMs`
    let sharedGuilds = bot.guilds.filter(g => {return g.member(message.author)})
    let guildsDMsDisabled = 0

    sharedGuilds.forEach(g => {
      if (settings.get(g.id).options.disableDMs) guildsDMsDisabled++
    })

    if (guildsDMsDisabled === sharedGuilds.size) return message.channel.send(`Hi ${message.author.username}! Also DMs are disabled!`)
  }

  message.channel.send(`Hi ${message.author.username}!`)
}
