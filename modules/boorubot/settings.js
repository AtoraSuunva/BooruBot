//Edit and view settings
module.exports.config = {
  name: 'settings',
  invokers: ['settings', 'setting', 'seting', 'set'],
  help: 'Change/view settings',
  expandedHelp: 'Change/View settings for BooruBot\nRequires "Manage Server" perms to change\n**Usage:**\n`setting` => View current settings\n`setting settingName` => View current setting + info about it\n`setting settingName newValue` => Change a setting '
}

const fs = require('fs')

module.exports.events = {}
module.exports.events.message = (bot, message) => {

  if (message.guild === null)
    return message.channel.sendMessage('You\'re in a DM, settings don\'t apply here!')

  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id //DMs are a channel, interestingly enough
  let settings = bot.modules.settings.get(settingsId) //yay settings
  let args = bot.modules.shlex(message.content)

    //b!settings aSetting true
    //['settings', 'aSetting', 'true']
    // 0           1           2

  if (args[1] === undefined) { //List all the settings
    let options = ''
    for (let option in settings.options) {
      options += `\`${option}\`: ${settings.options[option]}\n`
    }
    message.channel.sendMessage(`Current settings:\n${options}`)

  } else if (args[2] === undefined) { //List one setting + info
    switch (args[1]) {
      case 'topicEnable':
        message.channel.sendMessage(`\`${args[1]}\`: ${settings.options[args[1]]}\n` + '=> Only allow BooruBot to search in channels with `bb=true` in the topic (Other commands will still work, except no invite link for BB will be posted)')
      break;

      case 'disableDMs':
        message.channel.sendMessage(`\`${args[1]}\`: ${settings.options[args[1]]}\n` + '=> Disable users from DMing BooruBot if all shared servers have this set to true')
      break;

      default:
      message.channel.sendMessage('That\'s not a valid setting! Use `setting` to view them all')
    }

  } else { //Set a setting
    if (!message.member.hasPermission('MANAGE_GUILD') && message.author.id !== bot.modules.config.owner.id)
      return message.channel.sendMessage('You don\'t have "Manage Server" perms.')

    if (settings.options[args[1]] === undefined)
      return message.channel.sendMessage('That\'s not a valid setting! Use `b!setting` to view them all')

    let newVal

    if (typeof settings.options[args[1]] === 'string') {
      newVal = args[2]
    } else {
      newVal = toPrim(args[2])
    }

    if (typeof newVal !== typeof settings.options[args[1]])
      return message.channel.sendMessage(`The types don't match! You need a ${typeof settings.options[args[1]]}!`)

    settings.options[args[1]] = newVal
    message.channel.sendMessage(`Setting changed!\n\`${args[1]}\` = \`${settings.options[args[1]]}\``)
  }

  bot.modules.settings.set(settingsId, settings)
}

//Convert stuff to it's primitive values
//'True'      => true
//'false'     => false
//'342'       => 342
//'stringsda' => 'stringsda'
//'52332adsa' => '52332adsa'

function toPrim(val) {
  let prim = ((parseFloat(val) == val) ? parseFloat(val) : null) || ((val.toLowerCase() === 'true') ? true : null) || ((val.toLowerCase() === 'false') ? false : null)
  if (prim === null) prim = val //hacky fix since || will check the next one if it's false, meaning that false always returned a string
  return prim;
}
