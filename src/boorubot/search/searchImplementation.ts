import booru, { type Post } from 'booru'
import type { AnySite } from 'booru/dist/Constants.js'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
  codeBlock,
  inlineCode,
  MessageFlags,
} from 'discord.js'
import env from 'env-var'
import { getMergedSettings, shuffleArray, siteInfo } from '../utils.js'
import {
  filterPosts,
  formatFilteredPosts,
  formatPostToEmbed,
  formatTags,
  getErrorMessage,
  getInteractionChannel,
  getTagsMatchingBlacklist,
  hasOrderTag,
  NSFW_RATINGS,
  nsfwAllowedInChannel,
} from './searchUtils.js'

export const RANDOM_BOORU_VALUE = 'Random Booru'
export const RANDOM_BOORU_SITE = {
  domain: RANDOM_BOORU_VALUE,
}

const SEARCH_PREV = 'search/prev'
const SEARCH_PREV_EMOJI = '◀️'
const SEARCH_HIDE = 'search/hide'
const SEARCH_HIDE_EMOJI = '❌'
const SEARCH_SHOW = 'search/show'
const SEARCH_SHOW_EMOJI = '🔎'
const SEARCH_NEXT = 'search/next'
const SEARCH_NEXT_EMOJI = '▶️'
const SEARCH_POST_PUBLICLY = 'search/post'
const SEARCH_POST_PUBLICLY_EMOJI = '📝'

const IDLE_TIMEOUT = 10 * 60 * 1000 // 10 minutes in ms

export interface SearchSettings {
  site: { domain: string }
  tags: string[]
  ephemeral: boolean
}

const WHY_NO_NSFW_DM_URL =
  ' [How to opt into NSFW](https://github.com/AtoraSuunva/BooruBot#opting-into-nsfw).'

/**
 * Run the actual search, split out so that /link can use this as well, and to split
 * the "parse params" logic and "search booru" logic
 * @param interaction The interaction to reply to. Should not have already been replied-to nor deferred
 * @param SearchSettings The settings to search with. None of them are optional
 * @returns Nothing
 */
export async function runBooruSearch(
  interaction: ChatInputCommandInteraction,
  { site, tags, ephemeral }: SearchSettings,
) {
  // Fetch settings
  const settings = await getMergedSettings(interaction)

  // Incrementally validate things to fail early when possible
  if (settings.user.sites.includes(site.domain)) {
    return interaction.reply({
      content: `${site.domain} is blacklisted in your settings.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  if (settings.merged.sites.includes(site.domain)) {
    return interaction.reply({
      content: `${site.domain} is blacklisted here.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const { defaultTags } = settings.merged

  if (
    site.domain === 'danbooru.donmai.us' &&
    tags.length + defaultTags.length > 2
  ) {
    const appended =
      defaultTags.length > 0
        ? `\nThere are ${
            defaultTags.length
          } default tags set, so you can only add ${
            2 - defaultTags.length
          } more.`
        : ''

    return interaction.reply({
      content: `Sorry, but Danbooru only lets you search for 2 tags at a time.${appended}`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const blacklistedTagsUsed = getTagsMatchingBlacklist(
    tags,
    settings.merged.tags,
  )

  if (blacklistedTagsUsed.length > 0) {
    return interaction.reply({
      content: `Search contains blacklisted tags: ${codeBlock(
        formatTags(blacklistedTagsUsed),
      )}`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const originalTags = tags.slice(0)
  tags.push(...defaultTags)

  const channel = await getInteractionChannel(interaction)
  // Keep NSFW out of non-NSFW channels
  const allowNSFW = await nsfwAllowedInChannel(
    channel,
    settings.merged.config.allowNSFW,
  )

  const noNSFWMessage =
    !interaction.inGuild() && !allowNSFW ? WHY_NO_NSFW_DM_URL : ''

  if (!allowNSFW && getTagsMatchingBlacklist(tags, NSFW_RATINGS).length > 0) {
    return interaction.reply({
      content: `NSFW is not allowed in this channel.${noNSFWMessage}`,
      flags: MessageFlags.Ephemeral,
    })
  }

  // Then search
  const defer = interaction.deferReply({
    withResponse: true,
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })

  const startTime = process.hrtime.bigint()

  let unfilteredPosts: Post[] | null = null

  try {
    unfilteredPosts = await searchBooru({
      domain: site.domain,
      tags,
      blacklistedSites: settings.merged.sites,
    })
  } catch (e) {
    await defer
    const content =
      e instanceof SearchError
        ? e.message
        : `Error searching ${inlineCode(site.domain)}:\n${codeBlock(
            getErrorMessage(e),
          )}`

    return interaction.editReply({ content })
  }

  const endTime = process.hrtime.bigint()

  const { posts, filtered } = filterPosts(unfilteredPosts, {
    minScore: settings.merged.config.minScore,
    allowNSFW,
    blacklistedTags: settings.merged.tags,
  })

  if (posts.length === 0) {
    await defer

    if (unfilteredPosts.length === 0) {
      return interaction.editReply('No results found.')
    }

    const reasonCount = formatFilteredPosts(filtered)
    return interaction.editReply(
      `${unfilteredPosts.length} results found, but were all filtered.\n${reasonCount}${noNSFWMessage}`,
    )
  }

  const prevButton = new ButtonBuilder()
    .setCustomId(SEARCH_PREV)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(SEARCH_PREV_EMOJI)
    .setDisabled(true)

  const hideButton = new ButtonBuilder()
    .setCustomId(SEARCH_HIDE)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(SEARCH_HIDE_EMOJI)

  const nextButton = new ButtonBuilder()
    .setCustomId(SEARCH_NEXT)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(SEARCH_NEXT_EMOJI)
    .setDisabled(posts.length < 2)

  const postButton = new ButtonBuilder()
    .setCustomId(SEARCH_POST_PUBLICLY)
    .setStyle(ButtonStyle.Primary)
    .setEmoji(SEARCH_POST_PUBLICLY_EMOJI)
    .setLabel('Post Publicly')

  const row = new ActionRowBuilder<ButtonBuilder>()

  if (posts.length > 1) {
    row.addComponents([prevButton, hideButton, nextButton])
  } else {
    row.addComponents([hideButton])
  }

  if (ephemeral) {
    row.addComponents([postButton])
  }

  const color = interaction.guild?.members.me?.displayColor ?? '#34363C'
  let postNumber = 1
  const postCount = posts.length
  const timeTaken = endTime - startTime
  const formattedPost = formatPostToEmbed({
    post: posts[0],
    color,
    postNumber,
    postCount,
    filteredPosts: filtered,
    timeTaken,
    tags: originalTags,
    defaultTags,
  })

  const response = await defer
  const message = response.resource?.message ?? (await interaction.fetchReply())

  await interaction.editReply({
    ...formattedPost,
    components: [row],
  })

  /** Posts that were already publicly posted, to disable the button */
  const publiclyPostedPosts: string[] = []

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: IDLE_TIMEOUT,
  })

  // this uses closures so we can't extract it out :(
  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      return void i.reply({
        content:
          "You didn't initiate this search, so you can't interact with it.",
        flags: MessageFlags.Ephemeral,
      })
    }

    if (i.customId === SEARCH_POST_PUBLICLY) {
      // Disable "Post publicly" right after posting
      postButton.setDisabled(true)
      await i.update({
        components: [row],
      })

      const newPost = posts[postNumber - 1]
      const newFormattedPost = formatPostToEmbed({
        post: newPost,
        color,
      })
      publiclyPostedPosts.push(newPost.id)

      return void i.followUp({
        ...newFormattedPost,
        content: `Result posted by ${i.user}.`,
        allowedMentions: {
          parse: [],
        },
      })
    }

    if (i.customId === SEARCH_HIDE) {
      hideButton.setEmoji(SEARCH_SHOW_EMOJI)
      hideButton.setCustomId(SEARCH_SHOW)
      return void i.update({
        content: `Current post hidden, click ${SEARCH_SHOW_EMOJI} to reveal.`,
        embeds: [],
        components: [row],
      })
    }

    if (i.customId === SEARCH_PREV) {
      if (postNumber <= 1) {
        return void i.reply({
          content: 'There is no previous post.',
          flags: MessageFlags.Ephemeral,
        })
      }

      postNumber--
    }

    if (i.customId === SEARCH_NEXT) {
      if (postNumber >= postCount) {
        return void i.reply({
          content: 'There is no next post.',
          flags: MessageFlags.Ephemeral,
        })
      }

      postNumber++
    }

    const newPost = posts[postNumber - 1]

    // SEARCH_SHOW will fall through to here and this updates the buttons right
    // also means prev/next will correctly reset back to "hide" button
    hideButton.setEmoji(SEARCH_HIDE_EMOJI)
    hideButton.setCustomId(SEARCH_HIDE)
    prevButton.setDisabled(postNumber <= 1)
    nextButton.setDisabled(postNumber >= postCount)
    postButton.setDisabled(publiclyPostedPosts.includes(newPost.id))

    const newFormattedPost = formatPostToEmbed({
      post: newPost,
      color,
      postNumber,
      postCount,
      filteredPosts: filtered,
      timeTaken,
      appendContent: noNSFWMessage,
    })

    await i
      .update({
        ...newFormattedPost,
        components: [row],
      })
      .catch(() => {
        collector.stop('error')
      })
  })

  collector.on('end', async () => {
    await interaction.editReply({ components: [] }).catch(() => {
      /* ignore */
    })
  })

  return
}

type Keys = Record<string, string>

const BOORU_API_KEYS: Record<AnySite | 'api.rule34.xxx', Keys> = {
  // These boorus require API tokens (we leave them optional in case you run the bot and don't care about these):
  'gelbooru.com': env.get('GELBOORU_API_KEY').asJsonObject() as Keys,
  'api.rule34.xxx': env.get('RULE34XXX_API_KEY').asJsonObject() as Keys,
  'rule34.xxx': (env.get('RULE34XXX_API_KEY').asJsonObject() as Keys) ?? {},

  // Optional:
  'danbooru.donmai.us':
    (env.get('DANBOORU_API_KEY').asJsonObject() as Keys) ?? {},
  'e621.net': (env.get('E621_API_KEY').asJsonObject() as Keys) ?? {},
  'e926.net': (env.get('E926_API_KEY').asJsonObject() as Keys) ?? {},
  'hypnohub.net': (env.get('HYPNOHUB_API_KEY').asJsonObject() as Keys) ?? {},
  'konachan.com': (env.get('KONACHAN_API_KEY').asJsonObject() as Keys) ?? {},
  'konachan.net': (env.get('KONACHAN_API_KEY').asJsonObject() as Keys) ?? {},
  'yande.re': (env.get('YANDERE_API_KEY').asJsonObject() as Keys) ?? {},
  'safebooru.org': (env.get('SAFEBOORU_API_KEY').asJsonObject() as Keys) ?? {},
  'tbib.org': (env.get('TBIB_API_KEY').asJsonObject() as Keys) ?? {},
  'xbooru.com': (env.get('XBOORU_API_KEY').asJsonObject() as Keys) ?? {},
  'rule34.paheal.net':
    (env.get('RULE34PAHEAL_API_KEY').asJsonObject() as Record<
      string,
      string
    >) ?? {},
  'derpibooru.org':
    (env.get('DERPIBOORU_API_KEY').asJsonObject() as Keys) ?? {},

  // Dead API, to be removed later
  'realbooru.com': (env.get('REALBOORU_API_KEY').asJsonObject() as Keys) ?? {},
}

interface SearchBooruParams {
  domain: string
  tags: string[]
  blacklistedSites: string[]
}

async function searchBooru({
  domain,
  tags,
  blacklistedSites,
}: SearchBooruParams): Promise<Post[]> {
  const tagLimit = domain === 'danbooru.donmai.us' && tags.length > 1
  const random = !hasOrderTag(tags) && !tagLimit

  if (domain === RANDOM_BOORU_VALUE) {
    // Search every available booru until we get a hit
    const sites = shuffleArray(
      siteInfo
        .filter((site) => !blacklistedSites.includes(site.domain))
        .map((site) => site.domain),
    )

    for (const site of sites) {
      try {
        const results = await booru
          .search(site, tags, {
            limit: 100,
            random,
            credentials: BOORU_API_KEYS[site as AnySite] ?? {},
          })
          .then((res) => res.posts)
        if (results.length > 0) {
          return results
        }
      } catch {
        // ignore
      }
    }

    throw new SearchError('Failed to find any results in any booru')
  }

  return booru
    .search(domain, tags, {
      limit: 100,
      random,
      credentials: BOORU_API_KEYS[domain as AnySite] ?? {},
    })
    .then((res) => res.posts)
}

class SearchError extends Error {}
