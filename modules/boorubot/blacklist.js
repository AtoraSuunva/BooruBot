//Handle editing/viewing the blacklist

module.exports.config = {
  name: 'blacklist',
  invokers: ['blacklist', 'bl', 'whitelist', 'wl', 'unblacklist'],
  help: 'Blacklists/Whitelists tags/sites',
  expandedHelp: 'Allows you to blacklist tags/sites so they don\'t appear in searches\nEditing the blacklist requires "Manage Messages"',
  usage: ['Check the blacklist', 'blacklist', 'Blacklist a tag', 'blacklist tag cat', 'Blacklist tags', 'bl cat dog hat', 'Blacklist a site', 'bl site e6', 'Whitelist a tag', 'wl cat', 'Whitelist a site', 'wl site e6', 'Blacklist nsfw (or sfw) sites', 'bl sites nsfw']
}

const sep = '='.repeat(20)
const Booru = require('booru')

module.exports.events = {}

module.exports.events.message = (bot, message) => {
  const settingsId = (message.guild !== null) ? message.guild.id : message.channel.id
  const settings = bot.sleet.settings.get(settingsId)
  let [cmd, type, ...values] = bot.sleet.shlex(message.content, {lowercaseAll: true})

  const canEditBlacklist = (message.guild)
        ? message.member.permissions.has('MANAGE_MESSAGES') || message.author.id === bot.sleet.config.owner.id
        : true

  if (type && !type.endsWith('s'))
    type += 's'

  if (type && !['tags', 'sites'].includes(type))
    return message.channel.send('You need to specify if you\'re blacklisting `tags` or `sites`\nCheck `b!help blacklist` for more info')

  if (values.length && !canEditBlacklist)
    return message.channel.send('You need "Manage Messages" perms to edit the blacklist')

  if (['blacklist', 'bl'].includes(cmd)) {
    blacklist(message, settings, type, values)
  } else {
    whitelist(message, settings, type, values)
  }

  bot.sleet.settings.set(settingsId, settings)
  bot.sleet.settings.save(settingsId)
}

function blacklist(message, settings, type, values) {
  if (!type)
    return message.channel.send(`Blacklisted tags:\n${sep}\n[${settings.tags.join(', ')}]\n\nBlacklisted sites:\n${sep}\n[${settings.sites.join(', ')}]`, {code: 'asciidoc'})

  if (!values.length)
    return message.channel.send(`Blacklisted ${type}:\n${sep}\n[${settings[type].join(', ')}]`, {code: 'asciidoc'})

  const toBlacklist = (type === 'sites') ? getSites(values) : values

  settings[type] = ensureUnique(settings[type].concat(toBlacklist.filter(v => typeof v === 'string')))

  message.channel.send(
    toBlacklist.map(v => typeof v === 'string' ? `Blacklisted \`${v}\`` : `Failed to blacklist \`${v.v}\`: **${v.m}**`).join('\n') +
    '\n```asciidoc\n' +
    `Blacklisted ${type}:\n${sep}\n[${settings[type].join(', ')}]` +
    '\n```'
  )
}

function whitelist(message, settings, type, values) {
  if (!type)
    return message.channel.send(`I need a type [sites, tags] to blacklist`)

  if (!values.length)
    return message.channel.send(`I need something to whitelist`)

  if (values.map(v => v.toLowerCase()).includes('all')) {
    const old = settings[type]
    settings[type] = []

    return message.channel.send(`Cleared ${type} blacklist, removed: \`${old.join(', ')}\``)
  }

  const toWhitelist = (type === 'sites') ? getSites(values) : values

  settings[type] = settings[type].filter(v => !toWhitelist.includes(v))

  message.channel.send(
    toWhitelist.map(v => typeof v === 'string' ? `Whitelisted \`${v}\`` : `Failed to whitelist \`${v.v}\`: **${v.m}**`) +
    '\n```asciidoc\n' +
    `Blacklisted ${type}:\n${sep}\n[${settings[type].join(', ')}]` +
    '\n```'
  )
}

function getSites(values) {
  const sites = []
  let site

  for (let v of values) {
    if (v === 'all') {
      sites.push(...Object.keys(Booru.sites))
    } else if (['nsfw', 'sfw'].includes(v)) {
      const nsfw = v === 'nsfw'
      sites.push(
        ...Object.entries(Booru.sites).filter(s => nsfw === s[1].nsfw).map(s => s[0])
      )
    } else {
      site = Booru.resolveSite(v)
      sites.push(site === null ? {v, m: 'Unsupported site'} : site)
    }
  }

  return sites
}

function ensureUnique(arr) {
  return [...new Set(arr)]
}
