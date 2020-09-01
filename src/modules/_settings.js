async function getSettings(bot, guild_id) {
  const r = await bot.sleet.db.oneOrNone('SELECT * FROM booru_settings WHERE guild_id = $<guild_id>::BigInt', { guild_id })
  if (!r) return r
  return { guild_id: r.guild_id, tags: r.tags, sites: r.sites, nsfwServer: r.nsfwserver, minScore: r.minscore, topicEnable: r.topicenable, disableNextImage: r.disablenextimage }
}

function setSettings(bot, guild_id, settings) {
  return bot.sleet.db.any('UPDATE booru_settings SET tags = $<tags>, sites = $<sites>, nsfwServer = $<nsfwServer>, minScore = $<minScore>, topicEnable = $<topicEnable>, disableNextImage = $<disableNextImage> WHERE guild_id = $<guild_id>::BigInt', { guild_id, ...settings })
}

function deleteSettings(bot, guild_id) {
  return bot.sleet.db.any('DELETE FROM booru_settings WHERE guild_id = $<guild_id>::BigInt', { guild_id })
}

module.exports = {
  getSettings, setSettings, deleteSettings,
}
