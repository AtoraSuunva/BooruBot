/* The main file for the bot
 * No actual bot commands are run here, all this does is load the modules in the module folder and pass events
 */

const Discord = require('discord.js')
const escapeMarkdown = Discord.Util.escapeMarkdown
const fs = require('fs')
const path = require('path')
const Logger = require('./logger.js')
const Settings = require('./settings.js')
const snek = require('snekfetch')
const recurReadSync = require('recursive-readdir-sync') //to read all files in a directory, including subdirectories
//this allows you to sort modules into directories

const pmx = require('pmx').init({
  http          : true, // HTTP routes logging (default: true)
  ignore_routes : [], // Ignore http routes with this pattern (Default: [])
  errors        : true, // Exceptions logging (default: true)
  custom_probes : true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
  network       : true, // Network monitoring at the application level
})

const metrics = {
  messages_seen: pmx.probe().counter({name: 'Messages Seen'}),
  messages_sent: pmx.probe().counter({name: 'Messages Sent'}),
  commands_ran: pmx.probe().counter({name: 'Commands Ran'}),
  modules_ran: pmx.probe().counter({name: 'Modules Ran'}),
  guilds: pmx.probe().metric({name: 'Guilds'}),
  ping: pmx.probe().histogram({name: 'Ping', measurement: 'mean'}),
}

setInterval(() => metrics.ping.update(bot.ping), 3000)


let config = module.exports.config = require('./config.json') //Settings for the module system
let logger = module.exports.logger = new Logger('err.log', reportError, config.debug)
let settings = module.exports.settings = new Settings(logger)
let sentMessages = new Discord.Collection(), maxSentMessagesCache = 100

let modules = {}
let moduleErrors = []
loadModules()

//Actually starts listening to events
let events = getAllEvents()
//We do this to avoid listening to events that no modules use
//Unfortunately, this prevents adding a module that listens to a new event/adding a new event without restarting the bot
//one day I might find a fix for this

//let unusedEvents = getAllEvents({getUnused: true}) //Used right after to tell discord.js what events to not care about, so we can get a performance b o o s t

//logger.log(unusedEvents)

const bot = new Discord.Client()

/**
 * Load the listeners for all the events
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
            metrics.modules_ran.inc()
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
  bot.on('message', m => {
    metrics.messages_seen.inc()
    metrics.guilds.set(bot.guilds.size)
    processMessage(m)
  })

  bot.on('messageUpdate', (oldmessage, message) => {
    if (oldmessage.content !== message.content)
      processMessage(message)
  })

  function processMessage(message) {
    message.channel._message = message //for the fancy message update thingy
    //yay things
    for (let module in modules) {
      if (modules[module].events.everyMessage !== undefined) {
        //logger.debug(`Running ${module}`)

        new Promise((res, rej) => {
          try {
            modules[module].events.everyMessage(bot, message)
          } catch (e) {
            logErrorWithContext(e, message)
          }
        }).catch(e => logErrorWithContext(e, message))
      }
    }

    if (config.selfbot) {
      if (message.author.id !== bot.user.id) return
    } else {
      if (message.author.id === bot.user.id || message.author.bot) return //Don't reply to itself or bots
    }

    for (let module in modules) {
      if (modules[module].events.message !== undefined && startsWithInvoker(message.content, modules[module].config.invokers)) {
        if (config.botbans.some(b => b.id === message.author.id))
          return logger.info(`Botbanned user: ${message.author.username}#${message.author.discriminator} (${message.author.id})`)

        if (modules[module].config.invokers !== null && modules[module].config.invokers !== undefined)
          logger.debug(`Running ${module}`)

        metrics.commands_ran.inc()

        new Promise((res, rej) => {
          try {
            modules[module].events.message(bot, message)
          } catch (e) {
            logErrorWithContext(e, message)
          }
        }).catch(e => {
          logErrorWithContext(e, message)
          message.channel.send(`Something went wrong!\nI sent ${config.owner.username} some debug info.`)
        })
      }
    }
  }

  // delte a response if the call is deleted
  bot.on('messageDelete', deleteMessage)

  bot.on('messageDeleteBulk', messages => {
    messages.forEach(deleteMessage)
  })

  function deleteMessage(message) {
    for (let [key, val] of sentMessages) {
      if (val.id === message.id)
        return sentMessages.delete(key)
    }

    if (sentMessages.has(message.id)) {
      sentMessages.get(message.id).delete()
      return sentMessages.delete(message.id)
    }
  }

  logger.log('Events Loaded! Finally Ready!')
}
//Some helper functions

function logErrorWithContext(e, message) {
  ctx = {
    guild: message.channel.guild ? message.channel.guild.id : null,
    type: message.channel.type,
    channel: message.channel.id,
    messageId: message.id,
    messageContent: message.content
  }

  logger.error(e.stack + '\n' + JSON.stringify(ctx, null, 2))
}

let send = Object.getOwnPropertyDescriptor(Discord.TextChannel.prototype, 'send')

let handler = {
  apply(target, thisArg, args) {
    let promise, [content, options] = args, callMsg = thisArg._message

    const perms = thisArg.permissionsFor(bot.user)

    if (!perms.has('SEND_MESSAGES'))
      return

    if ( ((content && content.embed) || (options && options.embed)) && !perms.has('EMBED_LINKS') ) {
      logger.error('No embed support!!: ' + (new Error().stack))
      return target.call(thisArg, '`[ Embeds are disabled and no non-embed version is available ]`')
    }


    if (((content+'').trim() === '') && options === undefined) {
      content = 'Empty Message.\n' +
                (new Error()).stack.split('\n')[1].match(/(\/modules\/.+?)\)/)[1]
      // lol stacktraces
    }

    if (config.selfbot && callMsg && callMsg.author.id === bot.user.id) {
      if (options)
        promise = callMsg.edit(callMsg.content + '\n' + content, options)
      else if (typeof content === 'object')
        promise = callMsg.edit(callMsg.content, content)
      else
        promise = callMsg.edit(callMsg.content, {embed: {description: content}})

    } else if (!callMsg || !sentMessages.has(callMsg.id)) {
      promise = target.call(thisArg, content, options)
      logger.info('Sent new')

    } else {
      promise = sentMessages.get(callMsg.id).edit(content, options)
      logger.info('Edited old')
    }

    if (!config.selfbot && callMsg && callMsg.author.id !== bot.user.id && options && options.autoDelete !== false)
      promise.then(m => {
        sentMessages.set(callMsg.id, m)
        if (sentMessages.size > maxSentMessagesCache)
          sentMessages.delete(sentMessages.firstKey())
      })

    metrics.messages_sent.inc()
    return promise
  }
}

send.value = new Proxy(send.value, handler)
Object.defineProperty(Discord.TextChannel.prototype, 'send', send)


/**
 * Checks if a message starts with both a global invoker and an invoker in `invokers`
 * @param  {string}    msg      The message to check
 * @param  {string[]}  invokers An array of strings to use as invokers. If `null` is passed, no checks for invokers are made
 * @return {bool}               If the message starts with a global invoker + invoker listed
 */
function startsWithInvoker(msg, invokers) {
  if (invokers === null) return true
  msg = msg.toLowerCase().replace(/^(\/\/|\\\\\/\/\\\\)/, '').trim()

  let startsWith = false

  for (let invoker of config.invokers) { //Check for the global invoker(s)
    invoker = invoker.toLowerCase()
    if (msg.startsWith(invoker)) {
      startsWith = true
      msg = msg.replace(invoker, '').trim()
      break
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
 * @param  {string}   str     The string to shlex
 * @param  {Object}   options Shlex options
 * @return {string[]}         The result of the shlexed string
 */
function shlex(str, {
  lowercaseCommand = false,
  lowercaseAll = false,
  stripOnlyCommand = false,
  invokers = []
} = {}) {
  if (str === undefined || str === null) return []
  if (str.content) str = str.content

  const regex = /"([\s\S]+?[^\\])"|'([\s\S]+?[^\\])'|([^\s]+)/gm //yay regex
  let matches = []
  let result

  for (let invoker of config.invokers) {
    if (str.toLowerCase().startsWith(invoker.toLowerCase())) {
      str = str.substring(invoker.length).trim()
      break
    }
  }

  for (let invoker of invokers) {
    if (str.toLowerCase().startsWith(invoker.toLowerCase())) {
      matches.push(str.substring(0, invoker.length))
      str = str.substring(invoker.length).trim()
      break
    }
  }

  if (stripOnlyCommand) return str

  for (;;) {
    result = regex.exec(str)
    if (result === null) break
    matches.push(result[1] || result[2] || result[3])
  }

  if (lowercaseCommand)
    matches[0] = matches[0].toLowerCase()

  if (lowercaseAll)
    matches = matches.map(v => v.toLowerCase())

  return matches.map(v => v.replace(/\\(")|\\(')/g, '$1'))
}
module.exports.shlex = shlex

const uReg = {
  full: /(.+#\d+)/,
  user: /(\D+)/,
  id: /(\d+)/,
}

async function extractMembers(str, source, {id = false, keepIds = false} = {}) {
  let guild
  let message

  if (source instanceof Discord.Guild)
    guild = source
  else if (source instanceof Discord.Message)
    [guild, message] = [source.guild, source]
  else if (source instanceof Discord.Channel)
    guild = source.channel
  else
    throw new Exception('`source` must be one of [Guild, Message, Channel]')

  const arr = shlex(str)
  const users = []

  await guild.fetchMembers()

  for (let a of arr) {
    let match
    let u
    let la = a.toLowerCase()

    if (message && ['me', 'myself'].includes(la)) {
      u = message.member
    } else if (['you', 'yourself'].includes(la)) {
      u = guild.me
    } else if (['random', 'someone'].includes(la)) {
      u = guild.members.random()
    } else if (match = uReg.full.exec(a)) {
      u = guild.members.find(m => m.user.tag === match[1])
    } else if (match = uReg.id.exec(a)) {
      u = guild.members.get(match[1]) || (keepIds ? match[1] : undefined)
    } else {
      u = guild.members.find(m => m.user.username === a)
    }

    if (u) users.push(u)
  }

  if (id)
    return users.map(m => m.id || m)

  return users
}
module.exports.extractMembers = extractMembers

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

  moduleFiles = moduleFiles.filter(file => path.extname(file) === '.js') //only load js files

  let succ = []
  let fails = []

  for (let file of moduleFiles) {
    purgeCache(file)
    const rName = file.replace(path.join(__dirname, 'modules/'), '')

    try {
      const rFile = require(file)

      if (rFile.config === undefined)
        continue

      if (rFile.config.autoload === false || rFile.config.autoLoad === false) {
        logger.debug(`Skipping ${rName}: AutoLoad Disabled`)
        continue
      }

      logger.debug(`Loading ${rName}`)
      modules[rFile.config.name] = require(file)
      succ.push(rFile.config.name)
    } catch (e) {
      logger.warn(`Failed to load ${rName}: \n${e}`)
      fails.push(rName)
      moduleErrors.push({module: rName, error: e})
    }
  }

  logger.log(`Loaded: ${succ.join(', ')}`)

  if (fails.length > 0) {
    logger.warn(`Failed: ${fails.join(', ')}`)
  }

  return `Loaded ${succ.length} module(s) sucessfully; ${fails.length} failed.`
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

      const rName = file.replace(path.join(__dirname, 'modules/'), '')
      const rFile = require(file)

      if (rFile.config && moduleName === rFile.config.name) {
        logger.debug(`Loading ${rName}`)
        purgeCache(file)
        modules[moduleName] = require(file)
        return `Loaded ${moduleName} successfully`
      }
    }

    return 'Could not find module.'
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
        return `Successfully unloaded ${moduleName}`
      }
    }

    return 'Could not find module'
  } catch (e) {
    logger.error(e)
    return 'Something went wrong!'
  }
}
module.exports.unloadModule = unloadModule

/**
 * Gets info for a single module
 * @param  {string} moduleName The name of the module
 * @return {Object}            The config, path and dir of the module (Or a string if something went wrong)
 */
function getModuleInfo(moduleName) {
  try {
    let moduleFiles = recurReadSync(path.join(__dirname, 'modules'))

    for (let file of moduleFiles) {
      if (path.extname(file) !== '.js') continue

      let config = require(file).config
      if (config && moduleName === config.name) {
        let p = file
        let dir = path.parse(file).dir.split(path.sep).pop() //returns the folder it's in
        return {config, path: p, dir}
      }
    }

    return 'Could not find module'
  } catch (e) {
    logger.error(e)
    return 'Something went wrong!'
  }
}
module.exports.getModuleInfo = getModuleInfo

//Code I took from SO to clear the module cache
/**
 * Removes a module from the cache
 *
 * @param {string} moduleName The module to purge the cache for
 */
function purgeCache(moduleName) {
  const mod = require.resolve(moduleName)
  Object.keys(require.cache).forEach(key => key === mod && delete require.cache[key])
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
    bot.users.get(config.owner.id).send(errMsg, {split: {prepend: '```js\n', append: '\n```'}})
  return errID
}
module.exports.reportError = reportError

/**
 * Promisefied fs.writefile
 * @param  {String} fileName    The filename to write to
 * @param  {Object} fileContent Some JSON object to save
 * @return {Promise}            Promise that resolves with nothing on save
 */
function writeFile(fileName, fileContent) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, JSON.stringify(fileContent, null, 2), (e) => {
      if(e) reject(e)
      else  resolve()
    })
  })
}

/**
 * Create a gist
 * @param  {Object}    files       The files to add, in format of {"filename.txt": {content: "words"}}
 * @param  {String=''} filename    An optional param to specify the filename, if specified "files" is interpreted as the text to upload
 * @param  {String=''} description An optional description for the gist
 * @return {Promise} GitHub's response
 */
function createGist(files, {filename = '', description = ''} = {}) {
  if (filename) {
    files = {[filename]: {content: files}}
  }

  return snek.post('https://api.github.com/gists', {
    headers: {
      'User-Agent': `${bot.user.username} Bot by ${config.owner.username} on Discord`,
      'Authorization': `token ${config.githubToken}`
    },
    data: {files, description}
  })
}
module.exports.createGist = createGist

/**
 * Formats a user like `**username**#discrim`
 * Or optionally `**username**#discrim (id)`
 * Adds a left-to-right character `\u{200e}` to deal correctly with arabic usernames etc
 *
 * @param {Discord.User} The user to format
 * @param {addId=true}   If `(id)` should be appended
 * @return {String} The formatted string
 */
function formatUser(user, addID = true) {
  return `**${escapeMarkdown(user.username)}**\u{200e}#${user.discriminator} ${addID ? '(' + user.id + ')' : ''}`
}
module.exports.formatUser = formatUser

startEvents()

logger.info('Starting Login...')

bot.login(config.token).then( async () => {
  logger.info('Logged in!')

  if (config.owner === null) {
    logger.info('Fetching Owner info...')

    const oAuth = await bot.fetchApplication()
    config.owner = OAuth.owner

    fs.writeFile('./config.json', JSON.stringify(config, null, 2), (err) => {
      logger.info((err) ? err : 'Saved Owner info!')
    })
  }

  if (moduleErrors.length > 0) {
    reportError(moduleErrors.map(v => `${v.module}: ${v.error.message}`).join('\n'), 'Failed to load modules')
  }
})

bot.on('disconnect', reason => {
  logger.warn(reason)
  saveAndExit()
})

process.on('exit', code => {
  bot.destroy()
  logger.error(`About to exit with code: ${code}`)
})

process.on('unhandledRejection', (reason, p) => {
  logger.error(`Uncaught Promise Error: \n${reason}\nStack:\n${reason.stack}\nPromise:\n${require('util').inspect(p, { depth: 2 })}`)
  fs.appendFile('err.log', p, console.err)
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

/**
 * An array of all the modules that are loaded
 * @type {Object[]}
 */
module.exports.modules = modules

bot.logger = logger
bot.sleet = module.exports

// *cries in js*

