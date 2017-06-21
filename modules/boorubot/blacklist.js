//Handle editing/viewing the blacklist

module.exports.config = {
  name: 'blacklist',
  invokers: ['blacklist', 'bl', 'whitelist', 'wl'],
  help: 'Blacklists/Whitelists tags/sites',
  expandedHelp: 'Allows you to blacklist tags/sites\n\n**Usage:**\n`blacklist tag cat` => Blacklists the tag "cat"\n`blacklist site sb` => Blacklists safebooru\n`whitelist tag cat` => Removes "cat" from the blacklist\n\nYou can also use "all" to blacklist all sites or to clear the blacklist.\nView the blacklist with `blacklist [tags|site]`'
}

const fs = require('fs')

module.exports.events = {}

module.exports.events.message = (bot, message) => {
  let settingsId = (message.guild !== null) ? message.guild.id : message.channel.id //DMs are a channel, interestingly enough
  let settings = bot.modules.settings.get(settingsId)
  let args = bot.modules.shlex(message.content, {lowercaseAll: true})

  let canEditBlacklist = (message.guild !== null) ? message.member.hasPermission('MANAGE_MESSAGES') || message.author.id === bot.modules.config.owner.id : true //true if it's a dm
  //also true if it's me ;^)

  //b!bl tag cat
  //['bl', 'tag', 'cat']
  // 0     1      2

  if (args[1] !== undefined && !args[1].endsWith('s')) args[1] += 's'

  if (args[1] !== undefined && (args[1] !== 'tags' && args[1] !== 'sites')) {
    bot.modules.logger.log(args)
    message.channel.sendMessage('That\'s not something you can blacklist!')
    return;
  }

  //I'm sorry for how messy this following code is
  //i coded this at like at like 3am kek
  //also I'm too lazy to make this better somehow

  if (args[0] === 'blacklist' || args[0] === 'bl') { //blacklist somthin
    if (args[1] === undefined) {
      message.channel.sendCode('asciidoc', `Blacklisted tags:\n${'='.repeat(20)}\n[${settings.tags.join(', ')}]\n\nBlacklisted sites:\n${'='.repeat(20)}\n[${settings.sites.join(', ')}]`)

    } else if (args[2] === undefined && settings[args[1]] !== undefined) {
      message.channel.sendCode('asciidoc', `Blacklisted ${args[1]}:\n${'='.repeat(20)}\n[${settings[args[1]].join(', ')}]`)

    } else if (settings[args[1]] !== undefined) {
      if (!canEditBlacklist) return message.channel.sendMessage(`You can't edit the blacklist since you don't have "Manage Messages" perms`)

      if (args[1] === 'sites') {
        if (args[2] === 'all') {
          args[2] = Object.keys(require('booru').sites)
        } else if (args[2] === 'nsfw' || args[2] === 'sfw') {
          let sites = []
          for (let site of Object.entries(require('booru').sites)) {
            if ((args[2] === 'nsfw') ? site[1].nsfw : !site[1].nsfw) sites.push(site[0])
          }
          args[2] = sites
        } else {
          args[2] = require('booru').resolveSite(args[2])
          if (args[2] === false) {
            message.channel.sendMessage(`That's not a supported site!`)
            return;
          }
        }
      }

      if (args[1] === 'tags' && args[2] === 'all')
        return message.channel.send('I can\'t know all tags...')

      if (typeof args[2] === 'string')  args[2] = [args[2]]
      bot.modules.logger.log(args[2])
      settings[args[1]].push(...args[2])
      settings[args[1]] = ensureUnique(settings[args[1]])

      message.channel.sendMessage(
        `Added \`${args[2]}\` to \`${args[1]}\` blacklist!` +
        '\n```asciidoc\n' +
        `Blacklisted ${args[1]}:\n${'='.repeat(20)}\n[${settings[args[1]].join(', ')}]` +
        '\n```'
      ) //sorry not sorry
    }
  } else { //whitelist something
    if (!canEditBlacklist) return message.channel.sendMessage(`You can't edit the blacklist since you don't have "Manage Messages" perms`)
    if (args[1] === undefined) {
      message.channel.sendMessage('I can\'t whitelist nothing\n`whitelist tag/site something`' )

    } else if (args[2] === undefined && settings[args[1]] !== undefined) {
      message.channel.sendMessage('You didn\'t tell me what to whitelist')

    } else if (settings[args[1]] !== undefined) {

      if (args[1] === 'sites' && args[2] !== 'all') {
        args[2] = require('booru').resolveSite(args[2])
        if (args[2] === false) {
          message.channel.sendMessage(`That's not a supported site!`)
          return;
        }
      }

      if (!settings[args[1]].includes(args[2]) && args[2] !== 'all') {
        message.channel.sendMessage(`It's not even blacklisted in the first place!`)
        return;
      }

      settings[args[1]] = settings[args[1]].filter((val) => {return val !== args[2]})

      if (args[2] === 'all') {
        settings[args[1]] = []
      }

      message.channel.sendMessage(
        `Removed \`${args[2]}\` from the \`${args[1]}\` blacklist!` +
        '\n```asciidoc\n' +
        `Blacklisted ${args[1]}:\n${'='.repeat(20)}\n[${settings[args[1]].join(', ')}]` +
        '\n```'
      ) //sorry again
    }
  }

  bot.modules.settings.set(settingsId, settings)
}


function ensureUnique(arr) { //do some set magic
  return [...new Set(arr)]
}
