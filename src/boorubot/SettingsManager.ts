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
  allowNSFW: boolean | null
}

type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0]

class SettingsManager {
  async get(reference: Reference): Promise<BooruSettings> {
    const [config, defaultTags, tags, sites] = await prisma.$transaction(
      async (tx) =>
        Promise.all([
          this.getConfig(reference, tx),
          this.getDefaultTags(reference.id),
          this.getTags(reference.id),
          this.getSites(reference.id),
        ]),
    )

    return {
      config,
      defaultTags,
      tags,
      sites,
    }
  }

  async getConfig(
    reference: Reference,
    tx: PrismaTransaction = prisma,
  ): Promise<BooruConfig> {
    let config = await tx.booruConfig.findUnique({
      where: { referenceId: reference.id },
    })

    if (config && config.isGuild !== reference.isGuild) {
      config = await tx.booruConfig.update({
        where: { referenceId: reference.id },
        data: {
          allowNSFW: reference.allowNSFW,
          isGuild: reference.isGuild,
        },
      })
    }

    if (config === null) {
      config = await tx.booruConfig.create({
        data: {
          referenceId: reference.id,
          guildId: reference.guildId ?? null,
          allowNSFW: reference.allowNSFW,
          isGuild: reference.isGuild,
        },
      })
    }

    return config
  }

  async getTags(
    referenceId: string,
    tx: PrismaTransaction = prisma,
  ): Promise<string[]> {
    const tags = await tx.tag
      .findMany({
        where: { referenceId },
        select: { name: true },
      })
      .then((ts) => ts.map((t) => t.name))

    return tags
  }

  async getDefaultTags(
    referenceId: string,
    tx: PrismaTransaction = prisma,
  ): Promise<string[]> {
    const tags = await tx.defaultTag
      .findMany({
        where: { referenceId },
        select: { name: true },
      })
      .then((ts) => ts.map((t) => t.name))

    return tags
  }

  async getSites(
    referenceId: string,
    tx: PrismaTransaction = prisma,
  ): Promise<string[]> {
    const sites = await tx.site
      .findMany({
        where: { referenceId },
        select: { name: true },
      })
      .then((ss) => ss.map((s) => s.name))

    return sites
  }
}

export const settingsCache = new SettingsManager()
