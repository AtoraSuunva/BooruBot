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
  let msg = null
  let cmds = null
  let invokers = null
  let aliases = null

  if (args[1] === undefined) {

    cmds = new Map()  //map of [dir: [commands]]

    for (let module in modules) {
      if (modules[module].config.invisible !== true) {
        let info = bot.modules.getModuleInfo(module)
        if (typeof info === 'string') continue

        if (!cmds.has(info.dir))
          cmds.set(info.dir, [])

        cmds.get(info.dir).push(`[${modules[module].config.name}](): ${modules[module].config.help}`)
      }

    }
    invokers = `\`${config.invokers.join('\` | \`')}\``
  } else {
    mod = ''
    msg = `Could not find help for ${args[1]}`
    for (let module in modules) {
      if (modules[module].config.name === args[1] && modules[module].config.expandedHelp !== undefined) {
        mod = module
        msg = modules[module].config.expandedHelp
        if (modules[module].config.invokers) aliases = `\`${modules[module].config.invokers.join('\` | \`')}\``
      }
    }
  }

  embed.setAuthor(mod)

  if (cmds) {
    for (let [name, value] of cmds)
      embed.addField(capitalize(name), value.join('\n'), true)
  }

  if (msg)
    embed.setDescription(msg)

  if (invokers)
    embed.addField('Invokers:', invokers)

  if (aliases)
    embed.addField('Aliases:', aliases)

  message.channel.send({embed})
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}
