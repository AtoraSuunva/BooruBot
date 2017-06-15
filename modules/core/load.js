//Core module to reload modules

module.exports.config = {
  name: 'load',
  invokers: ['load', 'loaf', 'unfuck', 'unload'],
  help: '(Re)loads/unloads a module',
  expandedHelp: '(Re)loads a module.\n`(un)load [moduleName]`\n`load all`',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let config = bot.modules.config
  if (message.author.id !== config.owner.id) return

  let loadModule = bot.modules.loadModule
  let loadModules = bot.modules.loadModules
  let unloadModule = bot.modules.unloadModule

  let [cmd, module] = bot.modules.shlex(message.content)

  if (cmd !== 'unload') {
    if (module !== 'all') {
      message.channel.sendMessage(loadModule(module))
    } else {
      message.channel.sendMessage(loadModules())
    }
  } else {
    message.channel.sendMessage(unloadModule(module))
  }
}
