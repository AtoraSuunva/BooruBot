//Teaches you how to use BooruBot in case you're lost or something

module.exports.config = {
  name: 'tutorial',
  invokers: ['tutorial', 'toriel', 'continue', 'clean', 'keep'],
  help: 'Teaches you how to use BooruBot!',
  expandedHelp: `In case you have no idea what you're doing, you can use this to figure out how this bot works. \nNote: if the bot has "Manage Messages" perms it'll delete the tutorial when it's done.`,
  autoLoad: false
}

let tutMessages = []
let options = {max: 2, time: 60000, errors: ['time']}
let filter  = (m, args) => {for(let arg of args) {if (m.content.startsWith(arg)) return true} if (message.author.equals(bot.user)) return true; return false}
let exit    = (chn) => {chn.send(`Tutorial exited. Cleaning up messages if possible...`); if (tutMessages.length > 0) chn.bulkDelete(tutMessages)}
let sleep   = (time) => {return new Promise(function(resolve, reject) {setTimeout(()=>{resolve()}, time)})}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  (async function a() { //jshint ignore:line
    let args = bot.sleet.shlex(message.content)
    if (['continue', 'clean', 'keep'].includes(args[0])) return message.channel.send('👌')

    let canSearch = checkSearch(bot, message)
    let canEditBlacklist = message.member.permissions.has('MANAGE_MESSAGES')
    let canEditSettings = (message.guild !== null && message.member.permissions.has('MANAGE_GUILD'))
    let bbCanManageMessages = await message.guild.fetchMember(bot.user).then(m => m.permissions.has('MANAGE_MESSAGES')) //jshint ignore:line

    let prompts = [
      {ask: "*Tutorial started.*\nThe tutorial will continue automatically once you type in commands. When examples are given with words wrapped in `[]`, don't actually include them.\nTo continue, type `b!continue`\nTo exit anytime, just let the bot time out or type `b!exit`", waitFor: ['b!continue']},
      //Search
      {ask: "You can't search because `bb=true` isn't in the topic. Skipping Search tutorial.\nType `b!continue` to continue.", waitFor: ['b!continue'], need: !canSearch},
      {ask: "To search, use `b!search [site] [tag1] [tag2...]`.\nTry out `b!search safebooru cat`", waitFor: ['b!search safebooru cat'], need: canSearch},
      {ask: "You can also use the shorter version: `b!s [site] [tag]` and site aliases (replace `safebooru` with `sb`).\nSearch safebooru for cat again, but with the shorter command.", waitFor: ['b!s sb cat', 'b!s safebooru cat'], need: canSearch},
      {ask: "The bot can also keep searching random boorus until it finds an image (or runs out of boorus).\nTry `b!s rand cat dog`", waitFor: ['b!s rand cat dog'], need: canSearch},
      //Delete
      {ask: "To delete that last image, use `b!delete`.\nTry it now!", waitFor: ['b!delete', 'b!delet this', 'b!del'], need: canSearch},
      {ask: "You can delete multiple messages at a time using `b!delete [number]`.\nTry `b!delete 2`", waitFor: ['b!delete 2', 'b!del 2'], need: canSearch},
      //Blacklist
      {ask: "The blacklist will prevent you from searching certain tags and sites.\nTo view it, use `b!blacklist` or `b!bl`. Try it!", waitFor: ['b!blacklist', 'b!bl']},
      {ask: "You can't edit the blacklist (you need \"Manage Messages\" perms), so I'll skip over blacklist editing.\nType `b!continue` to continue.", waitFor: ['b!continue'], need: !canEditBlacklist},
      {ask: "To add a tag to the blacklist, use `b!blacklist tag [tag]` or `b!bl tag [tag]`.\nTry blacklisting `cat`!", waitFor: ['b!blacklist tag cat', 'b!bl tag cat'], need: canEditBlacklist},
      {ask: "To add a site to the blacklist, use `b!blacklist site [site]` or `b!bl site [site]`. Site aliases are supported!\nTry blacklisting `safebooru` (you can use `sb`)!", waitFor: ['b!blacklist site sb', 'b!bl site sb'], need: canEditBlacklist},
      {ask: "You can remove a tag from the blacklist using `b!whitelist tag [tag]` or `b!wl tag [tag]`\nGo ahead and whitelist `cat`.", waitFor: ['b!whitelist tag cat', 'b!wl tag cat'], need: canEditBlacklist},
      {ask: "Similarly, sites can be whilelisted with `b!whilelist site [site]` or `b!wl site [site]` (Site aliases are still supported!).\nWhitelist `safebooru` for me, could you?", waitFor: ['b!whilelist site sb', 'b!wl site sb'], need: canEditBlacklist},
      //Sites
      {ask: "You can view all the supported sites (and their aliases), using `b!sites`.\nGo ahead and try it!", waitFor: ['b!sites']},
      //Settings
      {ask: "I'll skip over settings, since you're in a DM with me and they don't apply here.\nType `b!continue` to continue.", waitFor: ['b!continue'], need: message.guild === null},
      {ask: "To view settings, use `b!settings`.\nCheck the settings!", waitFor: ['b!settings', 'b!set', 'b!setting', 'b!seting'], need: message.guild !== null},
      {ask: "Confused about a setting? Use `b!settings [settingName]` to get more info!\nTry it on `topicEnable`!", waitFor: ['b!settings topicEnable', 'b!set topicEnable', 'b!setting topicEnable', 'b!seting topicEnable'], need: message.guild !== null},
      {ask: "You don't have the \"Manage Guild\" perms, so you can't edit settings. I'll skip over setttings setting.\nType `b!continue` to continue.", waitFor: ['b!continue'], need: !canEditSettings},
      {ask: "Editing settings is simple, use `b!setting [settingName] [newValue]`.\nTry setting `topicEnable` to `true` or `false`!", waitFor: ['b!setting topicEnable true', 'b!setting topicEnable false'], need: canEditSettings},
      //End
      {ask: "That pretty much covers BooruBot.\nType `b!keep` to exit without deleting all tutorial messages.\nType `b!clean` to delete all tutorial messages.", waitFor: ['b!keep', 'b!clean'], need: bbCanManageMessages},
      {ask: "That pretty much covers BooruBot.\nI'd offer to delete all tutorial messages, but I don't have \"Manage Messages\" perms so ¯\\\_(ツ)\_/¯.\nType `b!finish` to end the tutorial", waitFor: ['b!finish'], need: !bbCanManageMessages}
      //{ask: "", waitFor: [''], need: true}*/
    ]


    for (let p of prompts) {
      if (p.need !== false) {
        bot.sleet.logger.log('ASKING: ' + p.ask)
        let messages = await prompt(message, p.ask, p.waitFor) //jshint ignore:line
        bot.sleet.logger.log('RECEIVED: ' + messages[1])
        tutMessages.push(...messages)
        if (tutMessages[tutMessages.length - 1].content.startsWith('b!exit')) {
          exit(message.channel)
          break;
        }
      }
    }

    bot.sleet.logger.log('asfasf' + tutMessages[tutMessages.length - 1].content.startsWith('b!clean') + ' aaa' + bbCanManageMessages)
    if (tutMessages[tutMessages.length - 1].content.startsWith('b!clean') && bbCanManageMessages)
      message.channel.bulkDelete(tutMessages) //jshint ignore:line

  })() //jshint ignore:line
}

function prompt(message, ask, waitfor) {
  return new Promise(function(resolve, reject) {

    message.channel.send(ask)
      .then(msg => {
        message.channel.awaitMessages(m => filter(m, [waitfor, 'b!exit']), options)
          .then(msgs => {
            if (msgs.first().content.startsWith('b!exit')) {
              tutMessages.push(msg)
              tutMessages.push(msgs.first())
              throw new Error('Exiting...')
            }
            resolve([msg, ...msgs.array()])
          })
          .catch(e => {bot.sleet.logger.log(e); exit(message.channel)})
      })
  })
}

//Perm checking

function checkSearch(bot, message) {
  if (settings.options.topicEnable && !message.channel.topic.includes('bb=true')) return false
  return true
}
