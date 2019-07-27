//help me
//Uses booru to search boorus
//The future is now
module.exports.config = {
  name: 'search',
  invokers: ['search', 's', ''],
  help: 'Searches boorus',
  expandedHelp: 'Allows you to search various boorus\n`search [booru] [tag1] [tag2...]`\n\nYou can use aliases for boorus (like `sb` for `safebooru`)\nUse `b!sites` to see them',
  usage: ['Search a booru', 'search e921.net', 'Search a booru with tags', 's e9 cat dog cute', 'Shorthand version', 'e9']
}

function SearchError(message) {
  this.name = 'SearchError'
  this.message = (message || 'Wow gg Atlas for forgetting to add a message')
}
SearchError.prototype = Error.prototype

const getSettings = require('./settings.js').getSettings

const snek = require('snekfetch')
const booru = require('booru')
const Discord = require('discord.js')
const path = require('path')

const prevImgs = new Map()
const nextImgTimeout = (5 * 60) * 1000 //5 mins
const nextImgEmoji = '\u{25B6}' // BLACK RIGHT-POINTING TRIANGLE
const deleteImgEmoji = '\u{274c}' // CROSS MARK

module.exports.events = {}
module.exports.events.raw = (bot, packet) => {
  if (packet.t === 'MESSAGE_DELETE') prevImgs.delete(packet.d.id)
}

module.exports.events.message = (bot, message) => {
  let settingsId = (message.guild) ? message.guild.id : message.channel.id //DMs are a channel, interestingly enough
  let settings = getSettings(bot, settingsId)
  let args = bot.sleet.shlex(message.content).map(_ => _.toLowerCase())

  // b!s sb cat cute
  // ['s', 'sb', 'cat', 'cute']
  //  0    1     2      3

  // damn making it work with no invoker smh
  // b!e6 cat cute
  // ['e6', 'cat', 'cute']

  if (booru.resolveSite(args[0]) || ['r', 'rand', 'random'].includes(args[0])) {
    args.unshift('')
  } else if (module.exports.config.invokers.includes(args[0])) {
    if (!booru.resolveSite(args[1]) && !['r', 'rand', 'random'].includes(args[1])) {
      return message.channel.send('That is not a valid site to search')
    }
  } else {
    return
  }

  let tags = args.slice(2)

  if (settings.options.topicEnable && message.channel.topic !== null && !message.channel.topic.includes('bb=true') && !message.isMentioned(bot.user) && !message.isLink)
    return message.channel.send('You need to enable searching in this channel by putting `bb=true` in the topic first (Set `topicEnable` to false to disable this).')

  if (message.guild &&
     !message.channel.nsfw &&
     !settings.options.nsfwServer &&
     compareArrays(tags, ['rating:e', 'rating:q', 'rating:explicit', 'rating:questionable']))
    return message.channel.send('Try searching something sfw.')

  if (args[1] === undefined)
    return message.channel.send('I at least need a site to work with...')

  let blacklistedTags = compareArrays(tags, settings.tags)

  if (blacklistedTags)
    return message.channel.send(`Search contains blacklisted tag${(blacklistedTags.length === 0) ? '' : 's'}: \`${blacklistedTags.join('`, `')}\``)

  if (settings.sites.length === Object.keys(booru.sites).length)
    return message.channel.send('All sites are blacklisted...')

  if (settings.sites.includes(booru.resolveSite(args[1])))
    return message.channel.send(`The site \`${booru.resolveSite(args[1])}\` is blacklisted here.`)

  if (!['r', 'rand', 'random'].includes(args[1]) && !booru.resolveSite(args[1]))
    return message.channel.send('That is not a supported site. Use `b!sites` to see them all.')

  message.botClient = bot

  if (['r', 'rand', 'random'].includes(args[1])) {
    message.channel.startTyping()
    randSearch(args.slice(2), settings, message)
      .then(r => postEmbed({ ...r, settings }))
      .catch(() => {
        message.channel.stopTyping()
        message.channel.send('Found no images anywhere...')
      })
  } else {
    message.channel.startTyping()
    search(args[1], args.slice(2), settings, message)
      .then(r => postEmbed({ ...r, settings }))
      .catch(e => {
        message.channel.stopTyping()
        const logE = e.innerErr || e

        if (e.message === 'You didn\'t give any images') {
          message.channel.send('Didn\'t find any images...')
        } else if (e.name === 'SearchError') {
          message.channel.send(e.message)
        } else if (logE.request && logE.request.res.statusCode) {
          const extra = logE.body.message
          message.channel.send('Got an error from the booru: \n```js\n'
           + `${logE.request.res.statusCode}: ${logE.request.res.statusMessage}`
           + (extra ? `\n${extra}` : '')
           + '\n```')
        } else if (e.message === 'You cannot search for more than 2 tags at a time') {
          message.channel.send('I cannot search more than 1 tag on Danbooru, since `order:random` takes up one tag. I would need to pay $20/$40 for 6/12 tags :(')
        } else if (e.message.startsWith('Internal Error:')) {
          message.channel.send(`Got an error from the booru: \n\`\`\`js\n${e.message}\n\`\`\``)
        } else {
          message.channel.send('Got an error: \n```js\n' + JSON.stringify(e.message, null, 2) + '\n```')

          bot.logger.error(logE)
        }
      })
  }
}

//Search a single booru
function search(site, tags, settings, message) {
  return new Promise((resolve, reject) => {

    let searchStart = process.hrtime()
    let nsfw = true
    let validImgs = []

    if (message.guild &&
        !message.channel.nsfw &&
        !settings.options.nsfwServer)
      nsfw = false

    booru.search(site, tags, {limit: 100, random: true})
      .then(imgs => {
        if (imgs[0] !== undefined) {

          for (let img of imgs) {
            if (img.file_url &&
               compareArrays(img.tags, settings.tags) === null &&
               !hasBlacklistedType(img.file_url, settings.tags) &&
               !hasBlacklistedRating(img.rating, settings.tags) &&
               (nsfw || !['e', 'q', 'u'].includes(img.rating.toLowerCase())) &&
               ([null, undefined].includes(settings.options.minScore) || img.score > settings.options.minScore))

              validImgs.push(img)
          }

          if (validImgs[0] !== undefined)
            resolve({imgs: validImgs, siteUrl: booru.resolveSite(site), searchTime: process.hrtime(searchStart), message})
          else
            reject(new SearchError('All found images are blacklisted.'))

        } else {
          reject(new SearchError('No images found.'))
        }
      })
      .catch(err => {
        if (err.name === 'BooruError') {
          err.booru = site
          err.tags = tags
          return reject(err)
        }

        const e = new Error('Something went wrong while searching...')
        e.innerErr = err

        reject(e)
      })
  })
}

// Keep searching boorus until you either find an image or run out of boorus
function randSearch(tags, settings, message) {
  return new Promise(async (resolve, reject) => {

    let result
    let randSites = Object.keys(booru.sites).sort(() => Math.random() - 0.5)

    for (let site of randSites) {
      if (settings.sites.includes(site)) continue

      // let searchTimeout = setTimeout(()=>{message.botClient.modules.logger.log(`Timed out ${site}`)}, maxTime)

      try {
        result = await search(site, tags, settings, message)
      } catch (e) { continue }

      // clearTimeout(searchTimeout)

      if (result === undefined || result.imgs === undefined || result.imgs[0] === undefined) continue
      return resolve(result)
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

function hasBlacklistedType(imgUrl, tags) {
  if (imgUrl === null)
    return false

  let types = tags.filter(t => t.startsWith('type:')).map(t => '.' + t.substring(5))
  let fileType = path.extname(imgUrl).toLowerCase()

  return types.includes(fileType)
}

function hasBlacklistedRating(rating, tags) {
  let ratings = tags.filter(t => t.startsWith('rating:')).map(t => t.substring(7))

  return ratings.includes(rating)
}

// Format the embed so I don't have to copy paste
async function postEmbed({ imgs = [], siteUrl = '', searchTime = 0, message = null, imageNumber = 0, numImages = 0, oldMessage = null, settings = { options: {} } } = {}) {
  const img = imgs.shift()
  imageNumber = (imageNumber || 0) + 1
  numImages   = numImages || (imgs.length + 1)

  if (img === undefined) return

  if (message.guild && !message.channel.permissionsFor(message.client.user).has('EMBED_LINKS')) {
    return message.channel.send(img.postView + '\n' + img.file_url)
  }

  let metadata = {
    user: message.author.id
  }

  let embed = new Discord.RichEmbed({
    author: {
      name: `Post ${img.id}`,
      url: img.postView // link directly to the post
    },
    image: { url: img.file_url },
    url: img.file_url,
    footer: {
      text: `${siteUrl} · ${imageNumber}/${numImages} · ${((searchTime[0] * 1e9 + searchTime[1]) / 1e6).toFixed(2)}ms`,
      icon_url: `https://www.${siteUrl}/favicon.ico` // pray they have their favicon here like a regular site
    }
  })

  let tags = (img.tags.join(', ').length < 50) ? Discord.util.escapeMarkdown(img.tags.join(', '))
    : Discord.util.escapeMarkdown(img.tags.join(', ').substr(0, 50)) +
             `... [See All](https://giraffeduck.com/api/echo/?w=${Discord.util.escapeMarkdown(img.tags.join(',').replace(/(%20)/g, '_')).replace(/([()])/g, '\\$1').substring(0,1200)})`

  let header
  let tooBig = false
  let imgError = false

  try {
    header = (await snek.head(img.file_url)).headers
  } catch (e) { imgError = true /* who needs to catch shit */}

  if (header)
    tooBig = (header['content-length'] / 1000000) > 10

  embed.setDescription(`**Score:** ${img.score} | ` +
                       `**Rating:** ${img.rating.toUpperCase()} | ` +
                       `[Image](${encodeURI(img.file_url.replace(/([()])/g, '\\$1'))}) | ` +
                       `${path.extname(img.file_url).toLowerCase()}, ${header ? fileSizeSI(header['content-length']) : '? kB'}\n` +
                       `**Tags:** ${tags}` +
                       ((!['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(img.file_url).toLowerCase())) ? '\n\n`The file will probably not embed.`' : '' ) +
                       ((tooBig) ? '\n`The image is over 10MB and will not embed.`' : '') + ((imgError) ? '\n`I got an error while trying to get the image.`' : '') )

  embed.setDescription(embed.description.substring(0, 2048))
  embed.setColor((message.guild) ? message.guild.members.get(message.client.user.id).highestRole.color : '#34363C')

  const afterPost = async msg => {
    message.channel.stopTyping()
    message.channel.lastImagePosted = msg // Lazy way to easily delete the last image posted, see `delete.js`

    if (!message.guild || message.channel.permissionsFor(message.guild.me).has('ADD_REACTIONS')) {

      try {
        if (msg.reacts === undefined) {
          if ((!message.guild || message.guild.me.permissions.has('USE_EXTERNAL_EMOJIS')) && message.client.emojis.get('318296455280459777'))
            await msg.react(message.client.emojis.get('318296455280459777'))
          else if (message.guild && message.channel.permissionsFor(message.client.user).has('ADD_REACTIONS'))
            await msg.react(deleteImgEmoji)
        }


        if (imageNumber !== numImages && !settings.options.disableNextImage) {
          await msg.react(nextImgEmoji).then(r => {
            // I tried to use awaitReactions or createReactionCollector instead, but they both acted buggy and often wouldn't catch new reacts
            // And in the end they stopped adding reacts completely
            let timeout = setTimeout(() => prevImgs.has(msg.id) && prevImgs.delete(msg.id) && r.remove().catch(_=>{}), nextImgTimeout)
            prevImgs.set(msg.id, { imgs, siteUrl, searchTime, message, imageNumber, numImages, timeout })
          })
        }
      } catch (e) {
        'do nothing'
      }
    }
  }

  const content = `${message.author.username}, result for \`${message.content}\`\n${img.postView}`

  if (oldMessage)
    return oldMessage.edit(content, {embed})

  message.channel.send(content, {embed}).then(afterPost).catch(e => message.botClient.logger.error('Failed to send post', e, embed))
}

module.exports.events.messageReactionAdd = async (bot, react, user) => {
  if (react.users.size < 2 || react.message.author.id !== bot.user.id || react.emoji.name !== nextImgEmoji) return
  if (!prevImgs.has(react.message.id)) return

  let { imgs, siteUrl, searchTime, message, imageNumber, numImages, timeout } = prevImgs.get(react.message.id)

  if (user.id !== message.author.id) return

  const settingsId = react.message.guild ? react.message.guild.id : react.message.channel.id
  const settings = getSettings(bot, settingsId)

  postEmbed({ imgs, siteUrl, searchTime, message, imageNumber: imageNumber + 1, numImages, oldMessage: react.message, settings })

  if (react.message.channel.type !== 'dm' && react.message.channel.permissionsFor(bot.user).has('MANAGE_MESSAGES'))
    react.remove(user)

  // If there's no more images
  if (imageNumber + 1 === numImages)
    return react.remove(bot.user)

  clearTimeout(timeout)
  timeout = setTimeout(() => prevImgs.has(react.message.id) && prevImgs.delete(react.message.id) && react.remove(), nextImgTimeout)

  prevImgs.set(react.message.id, {imgs, siteUrl, searchTime, message, imageNumber, numImages, timeout})
}

module.exports.events.messageDelete = (bot, message) => {
  prevImgs.delete(message.id)
}

// from https://stackoverflow.com/a/20463021
// slightly edited
function fileSizeSI(a,b,c,d,e){
  return (b=Math,c=b.log,d=1e3,e=c(a)/c(d)|0,a/b.pow(d,e)).toFixed(0)
 +(e?'kMGTPEZY'[--e]+'B':' Bytes')
}

