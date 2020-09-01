//Disply some stats

module.exports.config = {
  name: 'stats',
  invokers: ['stats'],
  help: 'Displays some stats about the bot',
  expandedHelp: 'Displays some stats.',
  usage: ['stats', 'stats']
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let fields = new Map()
  .set('Guilds:'  , bot.guilds.size)
  .set('Channels:', bot.channels.filter(c=>{return c.type === 'text'}).size)
  .set('Users:'   , bot.users.size)
  .set('DMs:'    , bot.channels.filter(c=>{return c.type === 'dm'}).size)

  .set('I\'ve existed for:', shittyMStoTime(new Date().getTime() - bot.user.createdTimestamp, '{w} {week} {d} {day} {hh}:{mm}:{ss}'))
  .set('Up for:', shittyMStoTime(bot.uptime, '{w} {week} {d} {day} {hh}:{mm}:{ss}'))

  if (message.guild !== null && message.channel.permissionsFor(message.client.user).has('EMBED_LINKS')) {
    let Discord = require('discord.js')
    let embed = new Discord.RichEmbed()
      .setThumbnail(bot.user.avatarURL)
      .setFooter('Use b!info for info!')

    for(let [title, val] of fields) {
      embed.addField(title, val, true)
    }

    return message.channel.send(`Here's some stats!`, {embed})
  } else {
    let msg = 'Here\'s some stats!\n'

    for (let [title, val] of fields) {
      msg += `**${title}**\n${val}\n`
    }

    return message.channel.send(msg)
  }
}

module.exports.events.ready = (bot) => {
  bot.sleet.logger.log(
`
Logged in as ${bot.user.username}#${bot.user.discriminator}
Currently in: ${bot.guilds.size} guilds, ${bot.channels.size} channels
Serving ${bot.users.size} users
`
  )
}

function shittyMStoTime(time, text) {
  let rep = new Map()
  rep
  .set('w'     , time / 604800000)
  .set('week'  , ((rep.get('w') === 1) ? 'week' : 'weeks'))
  .set('d'     , (time %= 604800000) ? time / 86400000 : 0)
  .set('day'   , ((rep.get('d') === 1) ? 'day' : 'days'))
  .set('h'     , (time %= 86400000) ? time / 3600000 : 0)
  .set('hh'    , (Math.floor(rep.get('h')) < 10) ? `0${Math.floor(rep.get('h'))}` : `${Math.floor(rep.get('h'))}`)
  .set('hour'  , ((rep.get('h') === 1) ? 'hour' : 'hours'))
  .set('m'     , (time %= 3600000) ? time / 60000 : 0)
  .set('mm'    , (Math.floor(rep.get('m')) < 10) ? `0${Math.floor(rep.get('m'))}` : `${Math.floor(rep.get('m'))}`)
  .set('minute', ((rep.get('m') === 1) ? 'minute' : 'minutes'))
  .set('s'     , (time %= 60000) ? time / 1000 : 0)
  .set('ss'    , (Math.floor(rep.get('s')) < 10) ? `0${Math.floor(rep.get('s'))}` : `${Math.floor(rep.get('s'))}`)
  .set('second', ((rep.get('s') === 1) ? 'second' : 'seconds'))

  for (let [format, val] of rep) {
    text = text.replace(new RegExp(`{${format}}`, 'g'), (typeof val === 'number') ? Math.floor(val) : val)
  }

  return text
}
