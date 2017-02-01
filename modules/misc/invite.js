//Invite the butt

module.exports.config = {
  name: 'invite',
  invokers: ['invite'],
  help: 'Get an invite for the bot/the help server!',
  expandedHelp: 'Use `b!invite` to invite the bot, `b!invite server` for an invite to the help server (DMed to you) so you can yell at me.'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id
  let settings = bot.modules.settings.get(settingsId)

  if (args[1] === 'server' || args[1] === 'guild') {
    if (allDMsDisabled(message.author))
     return message.channel.send('Sorry, all your DMs have `disableDMs` enabled...')

    message.author.send('https://discord.gg/0w6AYrrMIUfO71oV')
    return message.channel.send('Sent! Check your DMs')
  }

  bot.generateInvite(['MANAGE_MESSAGES'])
    .then(link => {
      if (settings.options.topicEnable && !message.channel.topic.includes('bb=true'))
        return message.channel.sendMessage('I can\'t send an invite in channels without `bb=true` in the topic (Set `topicEnable` to false to disable this).')

      if (allDMsDisabled(message.author))
        return message.channel.send('Sorry, all your DMs have `disableDMs` enabled, so I can\'t send an invite...')

      message.channel.send(`Invite me! (You can avoid giving me "Manage Messages" perms, but \`b!delete\` works better with it)\n~~${link}~~\nI'm private for now, sorry!\nUse \`b!invite server\` for the help server!`);
    })
}

function allDMsDisabled(user) {
  let sharedGuilds = bot.guilds.filter(g => g.member(user))
  let guildsDMsDisabled = 0

  sharedGuilds.forEach(g => {
    if (bot.modules.settings.get(g.id).options.disableDMs) guildsDMsDisabled++
  })

  return (guildsDMsDisabled === sharedGuilds.size)
}
