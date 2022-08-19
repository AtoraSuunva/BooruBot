import { BooruConfig } from '@prisma/client'
import { database } from '../util/db.js'

export interface BooruSettings {
  config: BooruConfig
  tags: string[]
  sites: string[]
}

class SettingsCache {
  #configCache = new Map<string, BooruConfig>()
  #tagsCache = new Map<string, string[]>()
  #sitesCache = new Map<string, string[]>()

  async get(referenceId: string): Promise<BooruSettings> {
    const [config, tags, sites] = await Promise.all([
      this.getConfig(referenceId),
      this.getTags(referenceId),
      this.getSites(referenceId),
    ])

    return {
      config,
      tags,
      sites,
    }
  }

  async getConfig(referenceId: string): Promise<BooruConfig> {
    const cache = this.#configCache.get(referenceId)

    if (cache) {
      return cache
    }

    let config = await database.booruConfig.findUnique({
      where: { referenceId },
    })

    if (config === null) {
      config = await database.booruConfig.create({
        data: { referenceId },
      })
    }

    this.#configCache.set(referenceId, config)

    return config
  }

  setConfig(referenceId: string, config: BooruConfig) {
    this.#configCache.set(referenceId, config)
  }

  deleteConfig(referenceId: string) {
    this.#configCache.delete(referenceId)
  }

  async getTags(referenceId: string): Promise<string[]> {
    const cache = this.#tagsCache.get(referenceId)

    if (cache) {
      return cache
    }

    const tags = await database.tag
      .findMany({
        where: { referenceId },
        select: { name: true },
      })
      .then((ts) => ts.map((t) => t.name))

    this.#tagsCache.set(referenceId, tags)

    return tags
  }

  setTags(referenceId: string, tags: string[]) {
    this.#tagsCache.set(referenceId, tags)
  }

  deleteTags(referenceId: string) {
    this.#tagsCache.delete(referenceId)
  }

  async getSites(referenceId: string): Promise<string[]> {
    const cache = this.#sitesCache.get(referenceId)

    if (cache) {
      return cache
    }

    const sites = await database.site
      .findMany({
        where: { referenceId },
        select: { name: true },
      })
      .then((ss) => ss.map((s) => s.name))

    this.#sitesCache.set(referenceId, sites)

    return sites
  }

  setSites(referenceId: string, sites: string[]) {
    this.#sitesCache.set(referenceId, sites)
  }

  deleteSites(referenceId: string) {
    this.#sitesCache.delete(referenceId)
  }
}

export const settingsCache = new SettingsCache()
