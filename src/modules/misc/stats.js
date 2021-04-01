//Disply some stats

const Discord = require('discord.js')

module.exports.config = {
  name: 'stats',
  invokers: ['stats'],
  help: 'Displays some stats about the bot',
  expandedHelp: 'Displays some stats.',
  usage: ['stats', 'stats'],
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  const guildCount = bot.guilds.cache.size
  const channelCount = bot.channels.cache.filter(c => {
    return c.type === 'text'
  }).size
  const userCount = bot.guilds.cache
    .values()
    .map(g => g.memberCount)
    .reduce((a, b) => a + b)
  const dmCount = bot.channels.cache.filter(c => {
    return c.type === 'dm'
  }).size
  const existence = formatTimeToString(
    new Date().getTime() - bot.user.createdTimestamp,
    '{w} {week} {d} {day} {hh}:{mm}:{ss}',
  )
  const uptime = formatTimeToString(
    bot.uptime,
    '{w} {week} {d} {day} {hh}:{mm}:{ss}',
  )

  const fields = new Map()
    .set('Guilds:', guildCount)
    .set('Channels:', channelCount)
    .set('Users:', userCount)
    .set('DMs:', dmCount)
    .set("I've existed for:", existence)
    .set('Up for:', uptime)

  if (
    message.guild !== null &&
    message.channel.permissionsFor(message.client.user).has('EMBED_LINKS')
  ) {
    const embed = new Discord.MessageEmbed()
      .setThumbnail(bot.user.avatarURL())
      .setFooter('Use b!info for info!')

    for (let [title, val] of fields) {
      embed.addField(title, val, true)
    }

    return message.channel.send(`Here's some stats!`, { embed })
  } else {
    let msg = "Here's some stats!\n"

    for (let [title, val] of fields) {
      msg += `**${title}**\n${val}\n`
    }

    return message.channel.send(msg)
  }
}

module.exports.events.ready = bot => {
  const userCount = bot.guilds.cache
    .map(g => g.memberCount)
    .reduce((a, b) => a + b)

  bot.sleet.logger.log(
    `
Logged in as ${bot.user.username}#${bot.user.discriminator}
Currently in: ${bot.guilds.cache.size} guilds, ${bot.channels.cache.size} channels
Serving ${userCount} users
`,
  )
}

function formatTimeToString(time, text) {
  let rep = new Map()
  rep
    .set('w', time / 604800000)
    .set('week', rep.get('w') === 1 ? 'week' : 'weeks')
    .set('d', (time %= 604800000) ? time / 86400000 : 0)
    .set('day', rep.get('d') === 1 ? 'day' : 'days')
    .set('h', (time %= 86400000) ? time / 3600000 : 0)
    .set(
      'hh',
      Math.floor(rep.get('h')) < 10
        ? `0${Math.floor(rep.get('h'))}`
        : `${Math.floor(rep.get('h'))}`,
    )
    .set('hour', rep.get('h') === 1 ? 'hour' : 'hours')
    .set('m', (time %= 3600000) ? time / 60000 : 0)
    .set(
      'mm',
      Math.floor(rep.get('m')) < 10
        ? `0${Math.floor(rep.get('m'))}`
        : `${Math.floor(rep.get('m'))}`,
    )
    .set('minute', rep.get('m') === 1 ? 'minute' : 'minutes')
    .set('s', (time %= 60000) ? time / 1000 : 0)
    .set(
      'ss',
      Math.floor(rep.get('s')) < 10
        ? `0${Math.floor(rep.get('s'))}`
        : `${Math.floor(rep.get('s'))}`,
    )
    .set('second', rep.get('s') === 1 ? 'second' : 'seconds')

  for (let [format, val] of rep) {
    text = text.replace(
      new RegExp(`{${format}}`, 'g'),
      typeof val === 'number' ? Math.floor(val) : val,
    )
  }

  return text
}
