//Core module to reload modules

module.exports.config = {
  name: 'load',
  invokers: ['load', 'loaf', 'unload', 'reload'],
  help: '(Re)loads/unloads a module',
  expandedHelp: '(Re)loads a module.\n**(un)load [moduleName]**\n**load all**',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let config = bot.modules.config
  if (message.author.id !== config.owner.id) return;

  let loadModule = bot.modules.loadModule
  let loadModules = bot.modules.loadModules
  let unloadModule = bot.modules.unloadModule
  let shlex = bot.modules.shlex

  let args = shlex(message.content)
  //Remember, the result of shlex is
  //['commandName', 'arg1', 'arg2'...]

  if (args[0] !== 'unload') {
    if (args[1] !== 'all') {
      message.channel.sendMessage(loadModule(args[1]))
    } else {
      message.channel.sendMessage(loadModules())
    }
  } else {
    message.channel.sendMessage(unloadModule(args[1]))
  }
}
