//Here's another, minimal example

module.exports.config = {
  name: 'invite',
  invokers: ['invite'],
  help: 'Get an invite for the bot/the help server!',
  expandedHelp: 'Use `b!invite` to invite the bot, `b!invite server` for the help server so you can yell at me (DMed to you)'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let args = bot.modules.shlex(message.content)

  if (args[1] === 'server' || args[1] === 'guild') {
    message.author.send('https://discord.gg/0w6AYrrMIUfO71oV')
    return message.channel.send('Sent! Check your DMs')
  }
  bot.generateInvite(['MANAGE_MESSAGES'])
  .then(link => {
    message.channel.send(`Invite me! (You can avoid giving me "Manage Messages" perms, but \`b!delete\` works better with it)\n~~${link}~~\nI'm private for now, sorry!`);
  })
}
