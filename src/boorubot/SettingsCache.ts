import { BooruConfig } from '@prisma/client'
import { prisma } from '../util/db.js'

export interface BooruSettings {
  config: BooruConfig
  defaultTags: string[]
  tags: string[]
  sites: string[]
}

export interface Reference {
  id: string
  guildId: string | null
  isGuild: boolean
}

class SettingsCache {
  #configCache = new Map<string, BooruConfig>()
  #tagsCache = new Map<string, string[]>()
  #defaultTagsCache = new Map<string, string[]>()
  #sitesCache = new Map<string, string[]>()

  async get(reference: Reference): Promise<BooruSettings> {
    const [config, defaultTags, tags, sites] = await Promise.all([
      this.getConfig(reference),
      this.getDefaultTags(reference.id),
      this.getTags(reference.id),
      this.getSites(reference.id),
    ])

    return {
      config,
      defaultTags,
      tags,
      sites,
    }
  }

  async getConfig(reference: Reference): Promise<BooruConfig> {
    const cache = this.#configCache.get(reference.id)

    if (cache) {
      return cache
    }

    let config = await prisma.booruConfig.findUnique({
      where: { referenceId: reference.id },
    })

    if (config && config.isGuild !== reference.isGuild) {
      config = await prisma.booruConfig.update({
        where: { referenceId: reference.id },
        data: {
          allowNSFW: reference.isGuild,
          isGuild: reference.isGuild,
        },
      })
    }

    if (config === null) {
      config = await prisma.booruConfig.create({
        data: {
          referenceId: reference.id,
          guildId: reference.guildId ?? null,
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

    const tags = await prisma.tag
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

  async getDefaultTags(referenceId: string): Promise<string[]> {
    const cache = this.#defaultTagsCache.get(referenceId)

    if (cache) {
      return cache
    }

    const tags = await prisma.defaultTag
      .findMany({
        where: { referenceId },
        select: { name: true },
      })
      .then((ts) => ts.map((t) => t.name))

    this.#defaultTagsCache.set(referenceId, tags)

    return tags
  }

  setDefaultTags(referenceId: string, tags: string[]) {
    this.#defaultTagsCache.set(referenceId, tags)
  }

  deleteDefaultTags(referenceId: string) {
    this.#defaultTagsCache.delete(referenceId)
  }

  async getSites(referenceId: string): Promise<string[]> {
    const cache = this.#sitesCache.get(referenceId)

    if (cache) {
      return cache
    }

    const sites = await prisma.site
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
