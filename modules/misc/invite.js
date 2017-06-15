//Invite the butt

module.exports.config = {
  name: 'invite',
  invokers: ['invite'],
  help: 'Get an invite for the bot/the help server!',
  expandedHelp: 'Use `b!invite` to invite the bot, `b!invite server` for an invite to the help server (DMed to you) so you can yell at me.',
  autoload: false
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id
  let settings = bot.modules.settings.get(settingsId)
  let args = bot.modules.shlex(message.content)

  if (allDMsDisabled(message.author))
    return message.channel.send('Sorry, all your DMs have `disableDMs` enabled, so I can\'t send an invite...')

  if (settings.options.topicEnable && !message.channel.topic.includes('bb=true'))
    return message.channel.sendMessage('I can\'t send an invite in channels without `bb=true` in the topic (Set `topicEnable` to false to disable this).')

  if (args[1] === 'server' || args[1] === 'guild') {
    message.author.send('https://discord.gg/0w6AYrrMIUfO71oV')
    return message.channel.send('Sent! Check your DMs')
  }

  bot.generateInvite(['MANAGE_MESSAGES', 'EMBED_LINKS'])
    .then(link => {
      //message.channel.send(`Invite me! (You can avoid giving me "Manage Messages" perms, but \`b!delete\` works better with it)\n~~${link}~~\nI'm private for now, sorry!\nUse \`b!invite server\` for the help server!`);
      message.channel.send(`Nah, how about I don't join.`)
    })
}

function allDMsDisabled(user) {
  let sharedGuilds = user.client.guilds.filter(g => g.member(user))
  let guildsDMsDisabled = 0

  sharedGuilds.forEach(g => {
    if (user.client.modules.settings.get(g.id).options.disableDMs) guildsDMsDisabled++
  })

  return (guildsDMsDisabled === sharedGuilds.size)
}
