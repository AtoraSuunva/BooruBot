module.exports.config = {
  name: 'delsettings',
  invokers: ['delsettings', 'delete settings'],
  help: 'Deletes your settings',
  expandedHelp: 'Deletes your settings permanently.\nRequires "Manage Server" perms to change',
  usage: ['Delete settings', 'delsetting', 'Alt', 'deletesettings']
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  const settingsId = (message.guild !== null) ? message.guild.id : message.channel.id // DMs are a channel
  let [cmd, confirm] = bot.sleet.shlex(message.content)

  if (confirm !== 'confirm')
    return message.channel.send(`Are you sure you want to delete all your settings? This cannot be undone.\nUse \`b!${cmd} confirm\` to confirm deletion.`)

  message.channel.send('Settings deleted.\nThey will be remade with their defaults when needed.')
  bot.sleet.settings.delete(settingsId)
}

