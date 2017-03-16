//Core module, displays help for every (non-invisible) module

module.exports.config = {
  name: 'help',
  invokers: ['help'],
  help: 'Helps you! (Use "help [command]" for more help!)',
  expandedHelp: 'This command doesn\'t do much else. But at least you know how to get more help!'
}

const Discord = require('discord.js')

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let modules = bot.modules.modules
  let config = bot.modules.config
  let args = bot.modules.shlex(message.content, {lowercaseAll: true})

  let embed = new Discord.RichEmbed()

  let mod = 'Commands: '
  let msg = ''
  let invokers = null
  let aliases = null

  if (args[1] === undefined) {
    for (let module in modules) {
      if (modules[module].config.invisible !== true) {
        msg += `\`${modules[module].config.name}\`: ${modules[module].config.help}\n`
      }
    }
    invokers = config.invokers.slice(0).map(v => `\`${v}\``).join(', ').replace(/\`\s*(<@.?\d+>)\s*\`/g, '$1')
  } else {
    mod = ''
    msg = `Could not find help for ${args[1]}`
    for (let module in modules) {
      if (modules[module].config.name === args[1] && modules[module].config.expandedHelp !== undefined) {
        mod = module
        msg = modules[module].config.expandedHelp
        aliases = `\`${modules[module].config.invokers.join('`, `')}\``
      }
    }
  }

  embed
    .setAuthor(mod)
    .setDescription(msg)

    if (invokers)
      embed.addField('Invokers:', invokers)
    if (aliases)
      embed.addField('Aliases:', aliases)

  message.channel.send({embed})
}
