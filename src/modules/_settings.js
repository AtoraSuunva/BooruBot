const defaults = {
  tags: [],
  sites: [],
  topicEnable: false,
  nsfwServer: false,
  minScore: null,
  disableNextImage: false,
}

async function getSettings(bot, guild_id, { created_settings = false } = {}) {
  const r = await bot.sleet.db.oneOrNone(
    'SELECT * FROM booru_settings WHERE guild_id = $<guild_id>::BigInt',
    { guild_id }
  )

  if (!r) {
    if (created_settings) {
      // Somehow failed to create settings?
      bot.logger.error('Failed to create settings for guild', guild_id)
      return r
    }

    // create settings
    await bot.sleet.db.none(
      'INSERT INTO booru_settings (guild_id, tags, sites, nsfwServer, minScore, topicEnable, disableNextImage) '
      + 'VALUES ($<guild_id>, $<tags>, $<sites>, $<nsfwServer>, $<minScore>, $<topicEnable>, $<disableNextImage>)',
      { guild_id, ...defaults }
    )

    // just recurse to get them
    return getSettings(bot, guild_id, { created_settings: true })
  }

  return { guild_id: r.guild_id, tags: r.tags, sites: r.sites, nsfwServer: r.nsfwserver, minScore: r.minscore, topicEnable: r.topicenable, disableNextImage: r.disablenextimage }
}

function setSettings(bot, guild_id, settings) {
  return bot.sleet.db.any(
    'UPDATE booru_settings SET tags = $<tags>, sites = $<sites>, nsfwServer = $<nsfwServer>, minScore = $<minScore>, topicEnable = $<topicEnable>, disableNextImage = $<disableNextImage> WHERE guild_id = $<guild_id>::BigInt',
    { guild_id, ...settings }
  )
}

function deleteSettings(bot, guild_id) {
  return bot.sleet.db.any(
    'DELETE FROM booru_settings WHERE guild_id = $<guild_id>::BigInt',
    { guild_id }
  )
}

module.exports = {
  getSettings, setSettings, deleteSettings, defaults,
}
