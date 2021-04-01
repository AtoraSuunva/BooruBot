//Core module, displays help for every (non-invisible) module

module.exports.config = {
  name: 'help',
  invokers: ['help'],
  help: 'Helps you! (Use "help [command]" for more help!)',
  expandedHelp:
    "This command doesn't do much else. But at least you know how to get more help!",
  usage: [
    'Well, you already did it',
    'help help',
    "but here's more help",
    'help someCommand',
  ],
}

const Discord = require('discord.js')

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let modules = bot.sleet.modules
  let config = bot.sleet.config
  let [cmd, ...helpFor] = bot.sleet.shlex(message.content, {
    lowercaseAll: true,
  })
  helpFor = helpFor.join(' ')

  let embed = new Discord.MessageEmbed()
  let mod = 'Commands: ',
    msg,
    cmds,
    invokers,
    usage,
    aliases

  if (helpFor === '') {
    cmds = new Map() //map of [dir: [commands]]

    for (let module in modules) {
      if (modules[module].config.invisible !== true) {
        let info = bot.sleet.getModuleInfo(module)
        if (typeof info === 'string') continue

        if (!cmds.has(info.dir)) cmds.set(info.dir, [])

        cmds
          .get(info.dir)
          .push(
            `[\`${modules[module].config.name}\`](http://a.ca): ${modules[module].config.help}`,
          )
      }
    }
    invokers = `\`${config.invokers.join('` | `')}\``
  } else {
    mod = ''
    msg = `Could not find help for '${helpFor}'`
    for (let module in modules) {
      if (
        modules[module].config.name === helpFor &&
        modules[module].config.expandedHelp !== undefined
      ) {
        mod = module
        msg = modules[module].config.expandedHelp
        if (modules[module].config.invokers)
          aliases = `\`${modules[module].config.invokers.join('` | `')}\``
        if (modules[module].config.usage) {
          const mUsage = modules[module].config.usage
          const inv = config.invokers[0]
          usage = ''
          for (let i = 0; i < mUsage.length; i += 2)
            usage += `${mUsage[i]}: \`${inv}${mUsage[i + 1]}\`\n`
        }
      }
    }
  }

  embed.setAuthor(mod)

  if (cmds) {
    for (let [name, value] of cmds)
      embed.addField(capitalize(name), value.join('\n'), true)
  }

  if (msg) embed.setDescription(msg)

  if (invokers) embed.addField('Invokers:', invokers)

  if (usage) embed.addField('Usage:', usage)

  if (aliases) embed.addField('Aliases:', aliases)

  message.channel.send({ embed })
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
