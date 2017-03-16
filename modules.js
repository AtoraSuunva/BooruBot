/* The main file for the bot
 *
 * No actual bot commands are run here, all this does is load the modules in the module folder and pass events
 */

const Discord = require('discord.js')
const fs = require('fs')
const path = require('path')
const Logger = require('./logger.js').Logger
const recurReadSync = require('recursive-readdir-sync') //to read all files in a directory, including subdirectories
//this allows you to sort modules into directories

let config = require('./config.json') //Settings for the module system
let logger = new Logger('err.log', reportError, config.debug)

let modules = {}
loadModules()

//Actually starts listening to events
let events = getAllEvents()
//We do this to avoid listening to events that no modules use
//Unfortunately, this prevents adding a module that listens to a new event/adding a new event without restarting the bot
//one day I might find a fix for this

let unusedEvents = getAllEvents({getUnused: true}) //Used right after to tell discord.js what events to not care about, so we can get a performance b o o s t

//logger.log(unusedEvents)

const bot = new Discord.Client()

/**
 * Load the listeners for all the events
 * @return void
 */
function startEvents() {
  logger.log('Loading events...')
  for (let event of events) {
    logger.debug(`Loading ${event}`)
    bot.on(event, (...args) => {
      //logger.debug(`Got ${event} event!`)
      for (let module in modules) {
        if (modules[module].events[event] !== undefined) {
          try {
            modules[module].events[event](bot, ...args)
          } catch (e) {
            logger.error(e, `Module Err: ${event}`)
          }
        }
      }
    })
  }

  //message doesn't like being in the loop
  //Also I need to do some extra checks anyways
  bot.on('message', processMessage)

  bot.on('messageUpdate', (oldmessage, message) => {
  	if (oldmessage.content !== message.content)
  		processMessage(message)
  })

  function processMessage(message) {

    //yay things
    for (let module in modules) {
      if (modules[module].events.everyMessage !== undefined) {
        logger.debug(`Running ${module}`)
        try {
          modules[module].events.everyMessage(bot, message)
        } catch (e) {
          logger.error(e, 'Module Err: message')
        }
      }
    }

    if (config.selfbot) {
      if (message.author.id !== bot.user.id) return
    } else {
      if (message.author.id === bot.user.id || message.author.bot) return //Don't reply to itself or bots
    }

    for (let module in modules) {
      if (modules[module].events.message !== undefined && startsWithInvoker(message.content, modules[module].config.invokers)) {
        if (config.botbans.some(b=>b.id === message.author.id))
          return logger.info(`Botbanned user: ${message.author.username}#${message.author.discriminator} (${message.author.id})`)

        logger.debug(`Running ${module}`)
        try {
          modules[module].events.message(bot, message)
        } catch (e) {
          logger.error(e, 'Module Err: message')
          message.channel.sendMessage(`Whoops, something went wrong!\nBug Atlas about it.`)
        }
      }
    }
  }

  logger.log('Events Loaded! Finally Ready!')
}
//Some helper functions

/**
 * Checks if a message starts with both a global invoker and an invoker in `invokers`
 * @param  {string}    msg      The message to check
 * @param  {string[]}  invokers An array of strings to use as invokers. If `null` is passed, no checks for invokers are made
 * @return {bool}               If the message starts with a global invoker + invoker listed
 */
function startsWithInvoker(msg, invokers) {
  if (invokers === null) return true
  msg = msg.toLowerCase()

  let startsWith = false

  for (let invoker of config.invokers) { //Check for the global invoker(s)
    invoker = invoker.toLowerCase()
    if (msg.startsWith(invoker)) {
      startsWith = true
      msg = msg.replace(invoker, '')
    }
  }

  if (!startsWith) return false
  startsWith = false

  for (let invoker of invokers) { //Check for the module invoker(s)
    invoker = invoker.toLowerCase()
    if (invoker === '') return true //Allow you to use '' as an invoker, meaning that it's called whenever the global invoker is used
    if (msg.startsWith(invoker)) {
      if (msg[msg.indexOf(invoker) + invoker.length] === undefined || msg[msg.indexOf(invoker) + invoker.length] === ' ') startsWith = true
      //You might be wondering why there's this long line here
      //It's not that I'm crazy, this is in fact to allow you to have 'h' and 'help' as invoker for two different commands
      //We check the character after the invoker to be sure we are matching the full thing and not just part of it

      //m!help ('help' and 'h' are both invokers, but for different commands)
      //help   (Strip the global invoker)
      //help   (Both 'help' and 'h' match, since 'help' starts with both)
      // ^  ^  (So we check the character after. It doesn't match 'h' since after it's 'e', not undefined or a space.)
      //In this case only 'help' runs. As it's meant to do
    }
  }

  return startsWith
}


/**
 * Removes the (global) invoker from a command and slices the arguments up into an array
 * m!test hello "there world!" aa
 * ['test', 'hello', 'there world', 'aa']
 *
 * @param  {string}   str The string to shlex
 * @return {string[]}     The result of the shlexed string
 */
function shlex(str, {lowercaseCommand = false, lowercaseAll = false} = {}) {
  for (let invoker of config.invokers) {
    if (str.indexOf(invoker) === 0) {
      str = str.replace(invoker, '')
      break
    }
  }
	let matches = []
	let regex = /"(.+?)"|'(.+?)'|([^\s]+)/g
	let result

	while (true) {
		result = regex.exec(str)
		if (result === null) break
		matches.push(result[1] || result[2] || result[3])
	}

  if (lowercaseCommand)
    matches[0] = matches[0].toLowerCase()

  if (lowercaseAll)
    matches = matches.map(v => v.toLowerCase())

	return matches
}
module.exports.shlex = shlex
/**
 * Gets all the events used by the modules
 * @param  {Object}   fuckIDunnoWhatJSDocWantsHere Object with only one property: getUnused. If the function should return unused events instead of used events
 * @return {string[]} All the events used by the modules
 */
function getAllEvents({getUnused = false} = {}) {
  let events = []

  for (let module in modules) {
    if (modules[module].events !== undefined)
      events.push(...Object.keys(modules[module].events))
  }

  events = Array.from(new Set(events)) //Ensure there's only unique events by using a set

  if (events.indexOf('message') !== -1) { //Remove the message event since we always listen for it
    events.splice(events.indexOf('message'), 1)
  }

  let discordEvents = Object.keys(Discord.Constants.WSEvents)

  //We're asked to return unused events, not used.
  if (getUnused) {
    for (let event of events.map(e => e.replace(/([A-Z])/g, '_$1').toUpperCase())) //SNAKE_CASE the events, so we can filter them correctly
      discordEvents = discordEvents.filter(e => e !== event)

    events = discordEvents.filter(e => e !== 'MESSAGE_CREATE')
    //Manually remove, bots usually always use this + the listener is always created
    //(also the event names mismatch ['message' !== 'MESSAGE_CREATE']
  } else {
    //Filter out events that aren't Discord events
    let eventsC = events
    events = []
    for (let event of discordEvents.map(e => e.toLowerCase().replace(/(_\w)/g, m => m.replace('_','').toUpperCase())))  //camelCase the events, not sorry for this
      eventsC.forEach(e => (e === event) ? events.push(e) : true)
  }

  return events
}

/**
 * Reload the config with from either the file or an object passed to it
 * @param  {Object} newConfig The new config to use
 */
function reloadConfig(newConfig) {
  purgeCache('./config.json')
  if (newConfig !== undefined) {
    config = newConfig
  } else {
    config = require('./config.json')
  }
  module.exports.config = config
}
module.exports.reloadConfig = reloadConfig
/**
 * Saves the currently stored config
 * @return {Promise} A promise that resolves when settings are saved
 */
function saveConfig() {
  return writeFile('./config.json', config)
}
module.exports.saveConfig = saveConfig
//More helper functions, but this time for managing the module system

/**
 * (Re)loads ALL modules
 * @return {string} The result of loading the modules
 */
function loadModules() {
  modules = {}
  //You might ask "why sync?", that's because there's no use in logging in if all modules aren't loaded yet
  let moduleFiles = recurReadSync(path.join(__dirname, 'modules'))

  moduleFiles = moduleFiles.filter((file) => {return path.extname(file) === '.js'}) //only load js files

  for (let file of moduleFiles) {
    purgeCache(`${file}`)

    if (require(`${file}`).config.autoLoad === false) {
      logger.debug(`Skipping ${file.replace(path.join(__dirname, 'modules/'), '')}: AutoLoad Disabled`)
      continue;
    }

    logger.debug(`Loading ${file.replace(path.join(__dirname, 'modules/'), '')}`)
    modules[require(`${file}`).config.name] = require(`${file}`)
  }

  logger.log(`Loaded: ${Object.keys(modules).join(', ')}`)
  return `Loaded ${Object.keys(modules).length} module(s) sucessfully`
}
module.exports.loadModules = loadModules
/**
 * (Re)load a single module
 * @param  {string} moduleName The name of the module to load
 * @return {string}            The result of loading the module
 */
function loadModule(moduleName) {
  try {
    let moduleFiles = recurReadSync(path.join(__dirname, 'modules'))

    for (let file of moduleFiles) {
      if (path.extname(file) !== '.js') continue
      if (moduleName === require(file).config.name) {
        logger.debug(`Loading ${file.replace(path.join(__dirname, 'modules/'), '')}`)
        purgeCache(file)
        modules[moduleName] = require(file)
        return `Loaded ${moduleName} sucessfully`
      }
    }

    return 'Could not find module'
  } catch (e) {
    logger.error(e)
    return 'Something went wrong!'
  }
}
module.exports.loadModule = loadModule
/**
 * Unload a single module
 * @param  {string} moduleName The module to unload
 * @return {string}            The result of unloading the module
 */
function unloadModule(moduleName) {
  try {
    let moduleFiles = recurReadSync(path.join(__dirname, 'modules'))

    for (let file of moduleFiles) {
      if (path.extname(file) !== '.js') continue
      if (moduleName === require(`${file}`).config.name) {
        logger.debug(`Unloading ${file.replace(path.join(__dirname, 'modules/'), '')}`)
        purgeCache(`${file}`)
        delete modules[moduleName]
        return `Sucessfully unloaded ${moduleName}`
      }
    }

    return 'Could not find module'
  } catch (e) {
    logger.error(e)
    return 'Something went wrong!'
  }
}
module.exports.unloadModule = unloadModule
/*  SETTINGS HERE WE GOOO
 *
 * Settings are stored in separate files under `settings/`
 * And are loaded only when needed
 * `settings` includes a bunch of functions to get/set/save settings
 * These funcs let me not need to mess with fs later on, along by letting me cache them instead of loading the files each time
 * Essentially this is just a wrapper around a map object that does some file loading/creating if the setting isn't cached
 */

/** A settings class to offer a few helper methods for settings */
class Settings {
  /**
   * Create the cache for settings
   */
    constructor() {
      this.cache = new Map() //Internal cache to store settings
      //You shouldn't ever need to use it
    }

    /**
     * Get all the settings
     * @return {Map} All the settings
     */
    get all() {
      return this.cache //I still let you get it because why not?
    }

    /**
     * Grabs settings for a guild/user
     * @param  {string} settingId The ID of the guild/user
     * @return {Object}           The settings for the guild/user
     */
    get(settingId) {
      this.verifyCacheFor(settingId)
      return this.cache.get(settingId)
    }

    /**
     * Sets settings for a guild/user
     * @param  {string} settingId The Id of the guild/user
     * @param  {Object} newVal    New settings to set
     * @return {Object}           The new settings
     */
    set(settingId, newVal) {
      this.verifyCacheFor(settingId)
      return this.cache.set(settingId, newVal).get(settingId)
    }

    /**
     * Saves settings for a guild/user
     * @param {string} settingId The ID of the guild/user
     */
    save(settingId) {
      this.verifyCacheFor(settingId)
      this.writeSettings(settingId, this.get(settingId))
      .then(() => {
        return;
      }).catch((e) => {
        logger.error(e, 'Save Settings (Create)') //fug
        throw e
      })
    }

    /**
     * Saves ALL the settings
     * Used to save before an exit/autosave
     *
     * @return {Promise} A Map containing all settings saved
     */
    saveAll() {
      let that = this
      return new Promise(function(resolve, reject) {
        let promises = []
        for (let setting of that.cache) { //[0] = settingId, [1] = settings
          promises.push(that.writeSettings(setting[0], setting[1]))
        }

        Promise.all(promises)
        .then(() => {
          resolve(that.cache)
        }).catch((e) => {
          logger.error(e, 'Save Settings (All)')
          reject()
        })

      })
    }

    /**
     * Checks the cache the the settings for settingId, then if it
     *
     * Exists and  Cached: Do nothing
     * Exists and !Cached: Load it
     * Doesn't Exist     : Create new settings for that settingId
     *
     * @param {string} settingId The id for the guild/user
     */
    verifyCacheFor(settingId) {
      if (this.cache.get(settingId) !== undefined) return; //It exists! We don't need to do anything

      //So we don't have the settings cached, let's load em'!
      try {
        this.cache.set(settingId, require(path.join(process.cwd(), `settings`, `${settingId}.json`)))
        return;
      } catch (e) {
        //Either it doesn't exist or it erroed, so we have to create new settings
        logger.debug(`Creating settings for: ${settingId}`)

        try {
          fs.writeFileSync(path.join(process.cwd(), `settings`, `${settingId}.json`), JSON.stringify(require('./defaultSettings.json'), null, 2))
          this.cache.set(settingId, require(path.join(process.cwd(), `settings`, `${settingId}.json`)))
          return;
        } catch(e) {
          logger.error(e, 'Save Settings (Create)') //fug
          throw e
        }
      }
    }

    /**
     *  A little wrapper thingy to promisefy node's writeFile funct. Also stringyfies for me
     *
     * @param {string} fileName    String, fileName to write
     * @param {Object} fileContent fileContent to write
     *
     * @return {Promise}           Used to tell when saving is finished
     */
    writeSettings(fileName, fileContent) {
      return new Promise(function(resolve, reject) {
        fs.writeFile(path.join(process.cwd(), `settings`, `${fileName}.json`), JSON.stringify(fileContent, null, 2), (e) => {
          if (e) reject(e)
          resolve()
        })
      })
    }
}

let settings = module.exports.settings = new Settings()

//And God said,
let there = 'light';
//and there was light.

//Code I took from SO to clear the module cache
/**
 * Removes a module from the cache
 *
 * @param {string} moduleName The module to purge the cache for
 */
 function purgeCache(moduleName) {
    // Traverse the cache looking for the files
    // loaded by the specified module name
    searchCache(moduleName, function (mod) {
        delete require.cache[mod.id]
    })

    // Remove cached paths to the module.
    // Thanks to @bentael for pointing this out.
    Object.keys(module.constructor._pathCache).forEach(function(cacheKey) {
        if (cacheKey.indexOf(moduleName)>0) {
            delete module.constructor._pathCache[cacheKey]
        }
    })
}

/**
 * Traverses the cache to search for all the cached
 * files of the specified module name
 *
 * @param {string} moduleName The name of the module to search the cache for
 * @param {Function} callback The callback to call
 */
function searchCache(moduleName, callback) {
  // Resolve the module identified by the specified name
  var mod = require.resolve(moduleName)

  // Check if the module has been resolved and found within
  // the cache
  if (mod && ((mod = require.cache[mod]) !== undefined)) {
    // Recursively go over the results
    (function traverse(mod) {
      // Go over each of the module's children and
      // traverse them
      mod.children.forEach(function (child) {
        traverse(child)
      })

      // Call the specified callback providing the
      // found cached module
      callback(mod)
    }(mod))
  }
}

/**
 * Assigns the error an ID, DMs me, and logs it
 * @param  {Error}  err     The error that happened
 * @param  {string} errType What kind of error happened
 * @return {number}         The error ID
 */
function reportError(err, errType) {
  let errID = Math.floor(Math.random() * 1000000).toString(16)
  let errMsg = `Error: ${errType}\nID: ${errID}\n\`\`\`js\n${err.toString()}\n\`\`\``

  if (!config.selfbot)
    bot.users.get(config.owner.id).sendMessage(errMsg, {split: {prepend: '```js\n', append: '\n```'}})
  return errID;
}
module.exports.reportError = reportError
/**
 * Promisefied fs.writefile
 * @param  {String} fileName    The filename to write to
 * @param  {Object} fileContent Some JSON object to save
 * @return {Promise}            Promise that resolves with nothing on save
 */
function writeFile(fileName, fileContent) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(fileName, JSON.stringify(fileContent, null, 2), (e) => {
      if (e) reject(e)
      resolve()
    })
  })
}

startEvents()

logger.info('Starting Login...')
bot.login(config.token).then(token => {
  logger.info('Logged in!')
  if (config.owner === null) {
    logger.info('Fetching Owner info...')
    bot.fetchApplication().then(OAuth => {
      config.owner = OAuth.owner
      fs.writeFile('./config.json', JSON.stringify(config, null, 2), (err) => {
        logger.info((err) ? err : 'Saved Owner info!')
      })
    })
  }
})

bot.on('disconnect', reason => {logger.log(reason)})

process.on('exit', code => {
  bot.destroy()
  logger.error(`About to exit with code: ${code}`)
})

process.on('unhandledRejection', (reason, p) => {
  logger.error(`Uncaught Promise Error: \n${reason}\nPromise:\n${require('util').inspect(p, { depth: 2 })}`)
  fs.appendFile('err.log', p, err => {})
})

/**
 * Saves then exits
 */
function saveAndExit() {
  settings.saveAll().then(() => {
    process.nextTick(process.exit()) //rippo
  }).catch(logger.error)
}
module.exports.saveAndExit = saveAndExit
//Export some stuff for utility purpose

//module.exports.shlex = shlex
//module.exports.loadModules = loadModules
//module.exports.loadModule = loadModule
// module.exports.unloadModule = unloadModule
// module.exports.reloadConfig = reloadConfig
// module.exports.saveConfig = saveConfig
// module.exports.reportError = reportError
// module.exports.settings = settings
// module.exports.saveAndExit = saveAndExit

/**
 * An array of all the modules that are loaded
 * @type {Object[]}
 */
module.exports.modules = modules

/**
 * Object with the current config being used
 * @type {Object}
 */
module.exports.config = config

/**
 * The Logger being used
 * @type {Logger}
 */
module.exports.logger = logger

bot.logger = logger
bot.modules = module.exports

//*cries in js*
