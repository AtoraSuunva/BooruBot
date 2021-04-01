//Disply info about the bot

const os = require('os')

module.exports.config = {
  name: 'info',
  invokers: ['info'],
  help: 'Find out about the bot!',
  expandedHelp: 'Get some ~~dirt~~ info about this bot.',
  usage: ['info', 'info'],
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  getCPUUsage().then(cpu => {
    let fields = new Map()
      .set(
        'Links:',
        '[Github](https://github.com/AtlasTheBot/Booru-Discord)\nBot Invite/Sever: `b!invite`',
      )
      .set(
        'Owner:',
        `${bot.sleet.config.owner.username}#${bot.sleet.config.owner.discriminator}`,
      )
      .set(
        'Using:',
        `Node ${process.version}\ndiscord.js v${require('discord.js').version}`,
      )
      .set('CPU:', `${(100 - cpu * 100).toFixed(2)}%`)
      .set(
        'RAM:',
        `${formatBytes(os.totalmem() - os.freemem(), 1)}/${formatBytes(
          os.totalmem(),
          1,
        )} - ${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(
          2,
        )}%`,
      )

    if (
      message.guild !== null &&
      message.channel.permissionsFor(message.client.user).has('EMBED_LINKS')
    ) {
      let Discord = require('discord.js')
      let embed = new Discord.MessageEmbed()
        .setAuthor(bot.user.username, bot.user.avatarURL())
        .setFooter('Use b!stats for stats!')

      for (let [title, val] of fields) {
        embed.addField(title, val, true)
      }

      return message.channel.send(`Here's info on me!`, { embed })
    } else {
      let msg = "Here's info on me!\n"

      for (let [title, val] of fields) {
        msg += `**${title}**\n${val}\n`
      }

      return message.channel.send(msg)
    }
  })
}

//WOO COMPUTER STUFF

function formatBytes(bytes, decimals) {
  if (bytes === 0) return '0 Bytes'
  let k = 1000,
    dm = decimals + 1 || 3,
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

//Following functions are small rewrites (for es6 stuff) of code from
//https://github.com/oscmejia/os-utils
//Big thanks to Oscar Mejia!

//returns the cpu usage in %
function getCPUUsage() {
  return new Promise((resolve, reject) => {
    let stats1 = getCPUInfo()

    setTimeout(() => {
      let stats2 = getCPUInfo()

      let idle = stats2.idle - stats1.idle
      let total = stats2.total - stats1.total

      resolve(idle / total)
    }, 1000)
  })
}

function getCPUInfo() {
  let idle = 0,
    total = 0,
    cpus = os.cpus()

  for (let cpu of cpus) {
    for (let thing in cpu.times) total += cpu.times[thing]
    idle += cpu.times.idle
  }

  return { idle: idle / cpus.length, total: total / cpus.length }
}
