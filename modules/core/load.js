//Core module to reload modules

module.exports.config = {
  name: 'load',
  invokers: ['load', 'loaf', 'unfuck', 'unload'],
  help: '(Re)loads/unloads a module',
  expandedHelp: '(Re)loads a module.',
  usage: ['Load a module', 'load moduleName', 'Unload a module', 'unload moduleName', '(Re)load all', 'load all'],
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
      message.channel.send(loadModule(module))
    } else {
      message.channel.send(loadModules())
    }
  } else {
    message.channel.send(unloadModule(module))
  }
}
