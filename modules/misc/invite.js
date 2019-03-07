//Invite the butt

module.exports.config = {
  name: 'invite',
  invokers: ['invite'],
  help: 'Get an invite for the bot/the help server!',
  expandedHelp: 'Get an invite for the bot or the help server.',
  usage: ['Invite the bot', 'invite', 'Get invite to help server', 'invite server']
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id
  let settings = bot.sleet.settings.get(settingsId)
  let args = bot.sleet.shlex(message.content)

  if (settings.options.topicEnable && !message.channel.topic.includes('bb=true'))
    return message.channel.send('I can\'t send an invite in channels without `bb=true` in the topic (Set `topicEnable` to false to disable this).')

  if (args[1] === 'server' || args[1] === 'guild') {
    message.author.send('https://discord.gg/0w6AYrrMIUfO71oV')
    return message.channel.send('Sent! Check your DMs')
  }

  bot.generateInvite(['MANAGE_MESSAGES', 'EMBED_LINKS'])
    .then(link => {
      message.channel.send(`Invite me! (You can avoid giving me "Manage Messages" perms, but \`b!delete\` works better with it)\n<${link}>\nUse \`b!invite server\` for the help server!`);
    })
}
