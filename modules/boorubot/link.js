//nab the post id from the message, do magic
module.exports.config = {
  name: 'link',
  invokers: ['link', 'ln'],
  help: 'Create an embed from a link to a post',
  expandedHelp: 'Creates an embed (like when you normally search) from a url by using magic!',
  usage: ['Create an embed from a url', 'b!link https:\/\/somebooru.com/post/12345', 'Link using just id', 'b![site] id:[id]']
}

const booru = require('booru')
const Discord = require('discord.js')
const search = require('./search.js')
const urlReg = /((?:https?:\/\/)?(www\.)?([-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b)([-a-zA-Z0-9@:%_+.~#?&\/\/=]*))/

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let [cmd, site] = bot.sleet.shlex(message)

  site = urlReg.exec(site)

  if (site === null)
    return message.channel.send(`That's not a valid url.`)

  let url       = site[0]
  let domain    = site[3]
  let booruInfo = booru.sites[domain]

  if (booruInfo === undefined)
    return message.channel.send('That site is not supported.')

  if (!url.includes(booruInfo.postView))
    return message.channel.send(`Doesn't seem like that's a link to a post.`)

  id = url.substring(url.indexOf(booruInfo.postView) + booruInfo.postView.length).split('/')[0]

  let dummyMessage = Discord.Util.cloneObject(message)

  dummyMessage.isLink = true
  dummyMessage.content = `b!${domain} id:${id}` //wew

  search.events.message(bot, dummyMessage)
}


