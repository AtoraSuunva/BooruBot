//help me
//Uses booru to search boorus
//The future is now
module.exports.config = {
  name: 'search',
  invokers: ['search', 's', ''],
  help: 'Searches boorus',
  expandedHelp: 'Allows you to search various boorus\n\n**Usage:**\n`search [booru] [tags1] [tag2...]`\n`search sb cat`\n\nYou can use aliases for boorus (like `sb` for `safebooru`)'
}

function SearchError(message) {
    this.name = 'SearchError'
    this.message = (message || 'Wow gg Atlas for forgetting to add a message')
}
SearchError.prototype = Error.prototype

const request = require('request-promise-native')
const booru = require('booru')
const Discord = require('discord.js')
const path = require('path')

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  let settingsId = (message.guild) ? message.guild.id : message.channel.id //DMs are a channel, interestingly enough
  let settings = bot.modules.settings.get(settingsId)
  let args = bot.modules.shlex(message.content).map(_ => _.toLowerCase())

  if (message.guild === null) { //It's a DM, time to check `disableDMs`
    let sharedGuilds = bot.guilds.filter(g => g.member(message.author))
    let guildsDMsDisabled = 0

    sharedGuilds.forEach(g => {
      if (bot.modules.settings.get(g.id).options.disableDMs) guildsDMsDisabled++
    })

    if (guildsDMsDisabled === sharedGuilds.size) return message.channel.send(`All of your servers have \`disableDMs\` enabled!`)
  }

  // b!s sb cat cute
  // ['s', 'sb', 'cat', 'cute']
  //  0    1     2      3

  // damn making it work with no invoker smh
  // b!e6 cat cute
  // ['e6', 'cat', 'cute']

  if (!module.exports.config.invokers.filter(_=>_!=='').includes(args[0])) {
    if (booru.resolveSite(args[0]) || ['r', 'rand', 'random'].includes(args[0]))
      args.unshift('')
    else
      return
  }

  let tags = args.slice(2)

  if (settings.options.topicEnable && message.channel.topic !== null && !message.channel.topic.includes('bb=true') && !message.isMentioned(bot.user) && !message.isLink)
    return message.channel.send('You need to enable searching in this channel by putting `bb=true` in the topic first (Set `topicEnable` to false to disable this).')

  if (message.guild &&
     !message.channel.nsfw &&
     !settings.options.nsfwServer &&
     compareArrays(tags, ['rating:e', 'rating:q', 'rating:explicit', 'rating:questionnable']))
    return message.channel.send('Try searching something sfw.')

  if (args[1] === undefined)
    return message.channel.send('I at least need a site to work with...')

  let blacklistedTags = compareArrays(tags, settings.tags)

  if (blacklistedTags)
    return message.channel.send(`Search contains blacklisted tag${(blacklistedTags.length === 0) ? '' : 's'}: \`${blacklistedTags.join('\`, \`')}\``)

  if (settings.sites.length === Object.keys(booru.sites).length)
    return message.channel.send('All sites are blacklisted...')

  if (settings.sites.includes(booru.resolveSite(args[1])))
    return message.channel.send(`The site \`${booru.resolveSite(args[1])}\` is blacklisted here.`)

  if (!['r', 'rand', 'random'].includes(args[1]) && booru.resolveSite(args[1]) === false)
    return message.channel.send('That is not a supported site. Use `b!sites` to see them all.')

  //Sure it looks simple and clean here, but don't scroll down
  if (['r', 'rand', 'random'].includes(args[1])) {
    message.channel.startTyping()
    message.botClient = bot
    randSearch([...args.slice(2)], settings, message)
      .then(r => postEmbed(...r)) //promises can only return one value, so I return an array then spread it
      .catch(e => {
        message.channel.stopTyping()
        message.channel.send('Found no images anywhere...')
      })
  } else {
    message.channel.startTyping()
    search(args[1], [...args.slice(2)], settings, message)
      .then(r => postEmbed(...r))
      .catch(e => {
        message.channel.stopTyping()
        if (e.message === 'You didn\'t give any images') {
          message.channel.send('Didn\'t find any images...')
        } else if (e.name === 'SearchError') {
          message.channel.send(e.message)
        } else {
          message.channel.send('Got an error: \n```js\n' + JSON.stringify(e.message, null, 2) + '\n```')
          bot.logger.error(e)
        }
      })
  }
}

//Search a single booru
function search(site, tags, settings, message) {
  return new Promise((resolve, reject) => {

    let searchStart = process.hrtime()
    let nsfw = true

    if (message.guild &&
        !message.channel.nsfw &&
        !settings.options.nsfwServer)
      nsfw = false

    booru.search(site, tags, {limit: 100, random: true})
    .then(booru.commonfy)
    .then((imgs) => {
      if (imgs[0] !== undefined) {

        for (let img of imgs) {
          if (compareArrays(img.common.tags, settings.tags) === null &&
              (nsfw || !['e', 'q', 'u'].includes(img.rating.toLowerCase())) &&
              ([null, undefined].includes(settings.options.minScore) || img.common.score > settings.options.minScore) )
            resolve([img, booru.resolveSite(site), process.hrtime(searchStart), message]) //can't resolve multiple values
        }
        reject (new SearchError('All found images are blacklisted.'))

      } else {
        reject(new SearchError('No images found.'))
      }
    })
    .catch((err) => {
      if (err.name === 'booruError')
        return reject(err)

      err.message = err.message += `\nError while searching in: ${(message.guild) ? message.guild.name : message.author.username} (${(message.guild) ? message.guild.id : 'DM'})\nInput: ${message.content}`
      let errID = message.botClient.modules.reportError(err, 'Search fail')
      reject(new Error(`Something went wrong while searching. Go yell at Atlas#2564 and tell him \`errID: ${errID}\``))
    })
  })
}

//Keep searching boorus until you either find an image or run out of boorus
function randSearch(tags, settings, message) {
  //oh god what am i doing
  return new Promise(async (resolve, reject) => {

  	let imgs
    let randSites = Object.keys(booru.sites).sort(_=>Math.random()-0.5)
    let searchStart = process.hrtime()
    let maxTime = 1 * 1000 //30 sec timeout

  	for (let site of randSites) {
      if (settings.sites.includes(site)) continue

      let searchTimeout = setTimeout(()=>{message.botClient.modules.logger.log(`Timed out ${site}`)}, maxTime)

      try {
        imgs = await search(site, tags, settings, message)
      } catch (e) { imgs = undefined; continue }

      clearTimeout(searchTimeout)

      if (imgs === undefined || imgs[0] === undefined) continue
      return resolve(imgs)
  	}
  	reject(new Error('Found no images anywhere...'))
  })
}
//the future is async
//async + promise + await

//Compares arrays for matching elements and returns the matches
//returns null if no matches are found
function compareArrays(arr1, arr2) {
  let matches = []
  arr1.forEach(ele1 => {arr2.forEach(ele2 => {if(ele1 === ele2) matches.push(ele1)})})

  return (matches[0] === undefined) ? null : matches
}

//Format the embed so I don't have to copy paste
async function postEmbed(img, siteUrl, searchTime, message) {

  if (message.guild && !message.channel.permissionsFor(message.client.user).hasPermission('EMBED_LINKS')) {
    return message.channel.send(
    encodeURI(`https:\/\/${siteUrl}${booru.sites[siteUrl].postView}${img.common.id}`) + '\n' +
    encodeURI(img.common.file_url) + '\nBooruBot works better if it has the "embeds links" permission'
  ).catch(err => {setTimeout(() => {throw err})})
    return
  }

  let metadata = {
    user: message.author.id
  }

  let embed = new Discord.RichEmbed({
    author: {
      name: `Post ${img.common.id}`,
      url: encodeURI(`https:\/\/${siteUrl}${booru.sites[siteUrl].postView}${img.common.id}`) //link directly to the post
    },
    image: {url: encodeURI(img.common.file_url)},
    url: encodeURI(img.common.file_url),
    footer: {
      text: `${siteUrl} - ${((searchTime[0] * 1e9 + searchTime[1])/1000000).toFixed(3)}ms`,
      icon_url: `https:\/\/www.${siteUrl}/favicon.ico` //pray they have their favicon here like a regular site
    }
  })

  let tags = (img.common.tags.join(', ').length < 50) ? Discord.util.escapeMarkdown(img.common.tags.join(', '))
             : Discord.util.escapeMarkdown(img.common.tags.join(', ').substr(0,50)) +
             `... [See All](http:\/\/All.Tags/${Discord.util.escapeMarkdown(img.common.tags.join(',').replace(/(%20)/g, '_')).replace(/([()])/g, '\\$1').substring(0,1700)})`

  let header, tooBig = false, imgError = false

  try {
    header = await request.head(encodeURI(img.common.file_url))
  } catch (e) { imgError = true /* who needs to catch shit */}

  if (header)
    toobig = (header['content-length'] / 1000000) > 10

  embed.setDescription(`**Score:** ${img.common.score} | ` +
                       `**Rating:** ${img.common.rating.toUpperCase()} | ` +
                       `[Image](${encodeURI(img.common.file_url.replace(/([()])/g, '\\$1'))}) | ` +
                       `${path.extname(img.common.file_url).toLowerCase()}\n` +
                       `**Tags:** ${tags} [](${JSON.stringify(metadata)})` +
                       ((!['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(img.common.file_url).toLowerCase())) ? '\n\n`The file will probably not embed.`' : '' ) +
                       ((tooBig) ? '\n`The image is over 10MB and will not embed.`' : '') + ((imgError) ? '\n`I got an error while trying to get the image.`' : '') )

  embed.setColor((message.guild) ? message.guild.members.get(message.client.user.id).highestRole.color : '#34363C')

  //bot.modules.logger.log(require('util').inspect(embed, { depth: null }));


  message.channel.send(`${message.author.username}, result for \`${message.content}\``, {embed})
    .then(msg => {
      message.channel.stopTyping()
      message.channel.lastImagePosted = msg //Lazy way to easily delete the last image posted, see `delete.js`

      if (!message.guild || message.channel.permissionsFor(message.guild.me).has('ADD_REACTIONS')) {
        let customEmote = (message.guild) ? new Map([['264246678347972610', '272782646407593986'],['211956704798048256', '269682750682955777']]).get(message.guild.id) : null
        //NSFW, squares
        //test server, glaceWhoa

        if (customEmote)
          msg.react(message.client.emojis.get(customEmote)).catch(() => {})
        else if (!message.guild || message.guild.me.permissions.has('USE_EXTERNAL_EMOJIS'))
          msg.react(message.client.emojis.get('318296455280459777')).catch(e => msg.react('❌').catch(() => {}))
        else
          msg.react('❌').catch(() => {})
      }
    })
}
