//Core module, displays help for every (non-invisible) module

module.exports.config = {
  name: 'help',
  invokers: ['help'],
  help: 'Helps you! (Use "help [command]" for more help!)',
  expandedHelp: 'This command doesn\'t do much else. But at least you know how to get more help!'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let shlex = bot.modules.shlex
  let modules = bot.modules.modules
  let config = bot.modules.config

  let args = shlex(message.content)

  msg = ''

  if (args[1] === undefined) {
    for (let module in modules) {
      if (modules[module].config.invisible !== true) {
        msg += `\`${modules[module].config.name}\`: ${modules[module].config.help}\n`
      }
    }
  } else {
    msg = `Could not find help for ${args[1]}`
    for (let module in modules) {
      if (modules[module].config.name === args[1] && modules[module].config.expandedHelp !== undefined) {
        msg = modules[module].config.expandedHelp + '\n\n' + `Invoked with: \`${modules[module].config.invokers.join('`, `')}\`\nDon't forget to also use \`${config.invokers.join('\`, or \`')}\``
      }
    }
  }

  message.channel.sendMessage(msg)
}
