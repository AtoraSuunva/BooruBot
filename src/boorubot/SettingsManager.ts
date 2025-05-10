import type { BooruConfig } from '../generated/prisma/client.js'
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

  async getConfig(
    reference: Reference,
    tx: PrismaTransaction = prisma,
  ): Promise<BooruConfig> {
    return await tx.booruConfig.upsert({
      where: { referenceId: reference.id },
      update: {
        isGuild: reference.isGuild,
      },
      create: {
        referenceId: reference.id,
        guildId: reference.guildId,
        allowNSFW: reference.allowNSFW,
        isGuild: reference.isGuild,
      },
    })
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
