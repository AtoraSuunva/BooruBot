//nab the post id from the message, do magic
module.exports.config = {
  name: 'link',
  invokers: ['link'],
  help: 'Create an embed from a link to a post',
  expandedHelp: '`b!link https:\/\/somebooru.com/post/12345`\nIf you have the ID and the site, you can also use `b![site] id:[id]'
}

const booru = require('booru')
const search = require('./search.js')
const urlReg = /((?:https?:\/\/)?(www\.)?([-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b)([-a-zA-Z0-9@:%_+.~#?&\/\/=]*))/

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let [cmd, site] = bot.modules.shlex(message)

  site = urlReg.exec(site)

  if (site === null)
    return message.channel.send(`That's not a valid url.`)

  let url    = site[0]
  let domain = site[3]
  let booruInfo = booru.sites[domain]

  if (booruInfo === undefined)
    return message.channel.send('That site is not supported.')

  if (!url.includes(booruInfo.postView))
    return message.channel.send(`Doesn't seem like that's a link to a post.`)

  id = url.substring(url.indexOf(booruInfo.postView) + booruInfo.postView.length).split('/')[0]

  message.content = `b!${domain} id:${id}` //wew

  search.events.message(bot, message)
}


