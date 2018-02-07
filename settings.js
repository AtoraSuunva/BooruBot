const fs = require('fs')
const path = require('path')
/* Settings are stored in separate files under `settings/`
 * And are loaded only when needed
 * `settings` includes a bunch of functions to get/set/save settings
 * These funcs let me not need to mess with fs later on, along by letting me cache them instead of loading the files each time
 * Essentially this is just a wrapper around a map object that does some file loading/creating if the setting isn't cached
 */

/** A settings class to offer a few helper methods for settings */
module.exports = class Settings {
  /**
   * Create the cache for settings
   */
  constructor(logger) {
    this.cache = new Map() //Internal cache to store settings
    //You shouldn't ever need to use it
    this.logger = logger
  }

  /**
   * Get all the settings
   * @return {Map} All the settings
   */
  get all() {
    return this.cache //I still let you get it because why not?
  }

  /**
   * Grabs settings for a guild/user
   * @param  {string} settingId The ID of the guild/user
   * @return {Object}           The settings for the guild/user
   */
  get(settingId) {
    this.verifyCacheFor(settingId)
    return this.cache.get(settingId)
  }

  /**
   * Sets settings for a guild/user
   * @param  {string} settingId The Id of the guild/user
   * @param  {Object} newVal    New settings to set
   * @return {Object}           The new settings
   */
  set(settingId, newVal) {
    this.verifyCacheFor(settingId)
    return this.cache.set(settingId, newVal).get(settingId)
  }

  /**
   * Saves settings for a guild/user
   * @param {string} settingId The ID of the guild/user
   */
  save(settingId) {
    this.verifyCacheFor(settingId)
    this.writeSettings(settingId, this.get(settingId))
      .then(() => {
        return
      }).catch((e) => {
        this.logger.error(e, 'Save Settings (Create)') //fug
        throw e
      })
  }

  /**
   * Saves ALL the settings
   * Used to save before an exit/autosave
   *
   * @return {Promise} A Map containing all settings saved
   */
  saveAll() {
    return new Promise((resolve, reject) => {
      let promises = []
      for (let setting of this.cache) { //[0] = settingId, [1] = settings
        promises.push(this.writeSettings(setting[0], setting[1]))
      }

      Promise.all(promises)
        .then(() => {
          resolve(this.cache)
        }).catch((e) => {
          this.logger.error(e, 'Save Settings (All)')
          reject()
        })

    })
  }

  /**
   * Checks the cache the the settings for settingId, then if it
   *
   * Exists and  Cached: Do nothing
   * Exists and !Cached: Load it
   * Doesn't Exist     : Create new settings for that settingId
   *
   * @param {string} settingId The id for the guild/user
   */
  verifyCacheFor(settingId) {
    if (this.cache.get(settingId) !== undefined) return //It exists! We don't need to do anything

    //So we don't have the settings cached, let's load em'!
    try {
      this.cache.set(settingId, require(path.join(process.cwd(), 'settings', `${settingId}.json`)))
      return
    } catch (e) {
      //Either it doesn't exist or it erroed, so we have to create new settings
      this.logger.debug(`Creating settings for: ${settingId}`)

      try {
        fs.writeFileSync(path.join(process.cwd(), 'settings', `${settingId}.json`), JSON.stringify(require('./defaultSettings.json')))
        this.cache.set(settingId, require(path.join(process.cwd(), 'settings', `${settingId}.json`)))
        return
      } catch (e) {
        this.logger.error(e, 'Save Settings (Create)') //fug
        throw e
      }
    }
  }

  /**
   *  A little wrapper thingy to promisefy node's writeFile funct. Also stringyfies for me
   *
   * @param {string} fileName    String, fileName to write
   * @param {Object} fileContent fileContent to write
   *
   * @return {Promise}           Used to tell when saving is finished
   */
  writeSettings(fileName, fileContent) {
    return new Promise(function (resolve, reject) {
      fs.writeFile(path.join(process.cwd(), 'settings', `${fileName}.json`), JSON.stringify(fileContent), (e) => {
        if (e) reject(e)
        resolve()
      })
    })
  }
}
