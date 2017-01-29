//help me
const booru = require('booru')

//Uses booru to search boorus
//The future is now
module.exports.config = {
  name: 'search',
  invokers: ['search', 's', ''],
  help: 'Searches boorus',
  expandedHelp: 'Allows you to search various boorus\n\n**Usage:**\n`search [booru] [tags1] [tag2...]`\n`search sb cat`\n\nYou can use aliases for boorus (like `sb` for `safebooru`)'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  message.bot = bot //wew, instead of passing the bot object I just attach it to the message object
  //Horrible idea, I know, but I'm not rewriting all this code just for color
  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id //DMs are a channel, interestingly enough
  let settings = bot.modules.settings.get(settingsId)
  let args = bot.modules.shlex(message.content)

  if (message.guild === null) { //It's a DM, time to check `disableDMs`
    let sharedGuilds = bot.guilds.filter(g => {return g.member(message.author)})
    let guildsDMsDisabled = 0

    sharedGuilds.forEach(g => {
      if (bot.modules.settings.get(g.id).options.disableDMs) guildsDMsDisabled++
    })

    if (guildsDMsDisabled === sharedGuilds.size) return message.channel.sendMessage(`All of your servers have \`disableDMs\` enabled!`)
  }

  // b!s sb cat cute
  // ['s', 'sb', 'cat', 'cute']
  //  0    1     2      3

  // damn making it work with no invoker smh
  // b!e6 cat cute
  // ['e6', 'cat', 'cute']

  if (!module.exports.config.invokers.filter(_=>_!=='').includes(args[0])) {
    if (booru.resolveSite(args[0]) || ['rand', 'random'].includes(args[0])) {
      args.unshift('')
    } else {
      return
    }
  }

  if (settings.options.topicEnable && !message.channel.topic.includes('bb=true'))
    return message.channel.sendMessage('You need to enable searching in this channel by putting `bb=true` in the topic first.')

  if (args[1] === undefined)
    return message.channel.sendMessage('I at least need a site to work with...')

  let blacklistedTags = compareArrays(args.slice(2), settings.tags)

  if (blacklistedTags)
    return message.channel.sendMessage(`Search contains blacklisted tag${(blacklistedTags.length === 0) ? '' : 's'}: \`${blacklistedTags.join('\`, \`')}\``)

  if (settings.sites.length === Object.keys(booru.sites).length)
    return message.channel.sendMessage('All sites are blacklisted...')

  if (settings.sites.includes(booru.resolveSite(args[1])))
    return message.channel.sendMessage(`The site \`${booru.resolveSite(args[1])}\` is blacklisted here.`)

  //Sure it looks simple and clean here, but don't scroll down
  if (['rand', 'random'].includes(args[1])) {
    message.channel.startTyping()
    message.botClient = bot
    randSearch([...args.slice(2), ...settings.tags.map(v=>{return `-${v}`})], message)
      .then((r) => {postEmbed(...r)}) //promises can only return one value, so I return an array then spread it
      .catch((e) => {
        message.channel.stopTyping()
        message.channel.sendMessage("Found no images anywhere...")
      })
  } else {
    message.channel.startTyping()
    search(args[1], [...args.slice(2), ...settings.tags.map(v=>{return `-${v}`})], message)
      .then((r) => {postEmbed(...r)})
      .catch((e) => {
        message.channel.stopTyping()
        if (e.message === "You didn't give any images") {
          message.channel.sendMessage("Didn't find any images...")
        } else {
          console.log(e)
          throw e
        }
      })
  }
}

//Search a single booru
function search(site, tags, message) {
  return new Promise((resolve, reject) => {

    let searchStart = process.hrtime()

    booru.search(site, tags, 1) //TODO: Check if site supports `order:random`
    .then(booru.commonfy)
    .then((imgs) => {
      if (imgs[0] !== undefined) {
        resolve([imgs[0], booru.resolveSite(site), process.hrtime(searchStart), message]) //can't resolve multiple values
      } else {
        reject('No images found')
      }
    })
    .catch((err) => {
      if (err.name === 'booruError') {
        reject(err.message)
        return;
      }

      err.message = err.message += `\nError while searching in: ${message.guild.id} (${message.name})\nInput: ${message.content}`
      let errID = bot.modules.reportError(err, 'Search fail')
      reject(`Something went wrong while searching. Go yell at Atlas#2564 and tell him \`errID: ${errID}\``)
    })
  })
}

//Keep searching boorus until you either find an image or run out of boorus
function randSearch(tags, message) {
  //oh god what am i doing
  //those jshint ignore comments are because it doesn't like async/await
  return new Promise(async function(resolve, reject) { //jshint ignore:line

  	let imgs
    let randSites = Object.keys(booru.sites).sort(_=>Math.random()-0.5)
    let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id //DMs are a channel, interestingly enough
    let settings = message.botClient.modules.settings.get(settingsId) //yay settings
    let searchStart = process.hrtime()

  	for (let site of randSites) {
  		console.log(`Searching ${site}`)
      if (settings.sites.includes(site)) {
         console.log('Skipping blacklisted site')
         continue
       }

  		try {
  			imgs = await booru.search(site, tags, 1).then(booru.commonfy).catch(console.log) //jshint ignore:line
  			if (imgs[0] === undefined) throw new Error('aaa') //why does this work
  			resolve([imgs[0], site, process.hrtime(searchStart), message])
        return;
  		} catch (e) {
  			console.log(`No images found...`)
  		}
  	}
  	reject('Found no images anywhere...')
  }) //jshint ignore:line
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
function postEmbed(img, siteUrl, searchTime, message) {

  if (message.guild !== null && !message.channel.permissionsFor(message.client.user).hasPermission('EMBED_LINKS')) {
    message.channel.send(
    encodeURI(`https://${siteUrl}${booru.sites[siteUrl].postView}${img.common.id}`) + '\n' +
    encodeURI(img.common.file_url) + '\nBooruBot works better if it has the "embeds links" permission'
  ).catch(err => {setTimeout(() => {throw err})})
    return
  }

  let Discord = require('discord.js')
  let embed = new Discord.RichEmbed({
    author: {
      name: `Post ${img.common.id}`,
      url: encodeURI(`https://${siteUrl}${booru.sites[siteUrl].postView}${img.common.id}`) //link directly to the post
    },
    image: {url: encodeURI(img.common.file_url)},
    url: encodeURI(img.common.file_url),
    footer: {
      text: `${siteUrl} - ${(searchTime[0] * 1e9 + searchTime[1])/1000000}ms`,
      icon_url: `https://${siteUrl}/favicon.ico` //pray they have their favicon here like a regular site
    }
  })

  embed.setDescription(`**Score:** ${img.common.score} | **Rating:** ${img.common.rating.toUpperCase()}`)

  embed.setColor((message.guild !== null) ? message.guild.members.get(message.bot.user.id).highestRole.color : '#34363C')

  //console.log(require('util').inspect(embed, { depth: null }));

  message.channel.sendEmbed(embed)
  .then(msg => {message.channel.lastImagePosted = msg;message.channel.stopTyping()}) //Lazy way to easily delete the last image posted, see `delete.js`
  .catch( err => {console.log(err); setTimeout(() => {throw err})} )
}
