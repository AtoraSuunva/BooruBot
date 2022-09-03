import { BooruConfig } from '@prisma/client'
import { database } from '../util/db.js'

export interface BooruSettings {
  config: BooruConfig
  tags: string[]
  sites: string[]
}

export type Reference = {
  id: string
  isGuild: boolean
}

class SettingsCache {
  #configCache = new Map<string, BooruConfig>()
  #tagsCache = new Map<string, string[]>()
  #sitesCache = new Map<string, string[]>()

  async get(reference: Reference): Promise<BooruSettings> {
    const [config, tags, sites] = await Promise.all([
      this.getConfig(reference),
      this.getTags(reference.id),
      this.getSites(reference.id),
    ])

    return {
      config,
      tags,
      sites,
    }
  }

  async getConfig(reference: Reference): Promise<BooruConfig> {
    const cache = this.#configCache.get(reference.id)

    if (cache) {
      return cache
    }

    let config = await database.booruConfig.findUnique({
      where: { referenceId: reference.id },
    })

    if (config && config.isGuild !== reference.isGuild) {
      config = await database.booruConfig.update({
        where: { referenceId: reference.id },
        data: {
          allowNSFW: reference.isGuild,
          isGuild: reference.isGuild,
        },
      })
    }

    if (config === null) {
      config = await database.booruConfig.create({
        data: {
          referenceId: reference.id,
          allowNSFW: reference.isGuild,
          isGuild: reference.isGuild,
        },
      })
    }

    this.#configCache.set(reference.id, config)

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
