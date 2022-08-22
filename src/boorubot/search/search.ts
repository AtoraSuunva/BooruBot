import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  codeBlock,
  ComponentType,
  inlineCode,
} from 'discord.js'
import { AutocompleteHandler, SleetSlashCommand } from 'sleetcord'
import { getMatchingSitesFor, getReferenceIdFor } from '../utils.js'
import booru from 'booru'
import { default as Post } from 'booru/dist/structures/Post.js'
import { settingsCache } from '../SettingsCache.js'
import {
  getTagsMatchingBlacklist,
  hasOrderTag,
  getErrorMessage,
  filterPosts,
  formatPostToEmbed,
  formatTags,
  NSFW_RATINGS,
  getInteractionChannel,
  nsfwAllowedInChannel,
} from './searchUtils.js'

const autocompleteSiteWithBlacklist: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  const referenceId = getReferenceIdFor(interaction)
  const userReferenceId = interaction.user.id
  const [settings, userSettings] = await Promise.all([
    settingsCache.get(referenceId),
    settingsCache.get(userReferenceId),
  ])

  const blacklistedSites = [...settings.sites, ...userSettings.sites]

  return getMatchingSitesFor(value)
    .filter((site) => !blacklistedSites.includes(site.domain))
    .map((site) => ({
      name: site.domain,
      value: site.domain,
    }))
}

export const search = new SleetSlashCommand(
  {
    name: 'search',
    description: 'Search a booru for posts',
    options: [
      {
        name: 'booru',
        description: 'The booru to search',
        required: true,
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteSiteWithBlacklist,
      },
      {
        name: 'tags',
        description: 'The tags to search for, space-separated (Default: none)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'ephemeral',
        description: 'Send a reply only you can see (Default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runSearch,
  },
)

const SEARCH_PREV = 'search/prev'
const SEARCH_PREV_EMOJI = '◀️'
const SEARCH_HIDE = 'search/hide'
const SEARCH_HIDE_EMOJI = '❌'
const SEARCH_SHOW = 'search/show'
const SEARCH_SHOW_EMOJI = '🔎'
const SEARCH_NEXT = 'search/next'
const SEARCH_NEXT_EMOJI = '▶️'
const SEARCH_POST_PUBLICALLY = 'search/post'
const SEARCH_POST_PUBLICALLY_EMOJI = '📝'

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes in ms

async function runSearch(interaction: ChatInputCommandInteraction) {
  const booruOption = interaction.options.getString('booru', true)
  const sites = getMatchingSitesFor(booruOption)

  if (sites.length !== 1) {
    interaction.reply({
      content: 'Could not find a single matching booru.',
    })
    return
  }

  // Get options
  const site = sites[0]
  const tags = (interaction.options.getString('tags') ?? '').split(' ')
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  // Fetch settings
  const referenceId = getReferenceIdFor(interaction)
  const userReferenceId = interaction.user.id
  const [settings, userSettings] = await Promise.all([
    settingsCache.get(referenceId),
    settingsCache.get(userReferenceId),
  ])

  // const blacklistedSites = [...settings.sites, ...userSettings.sites]
  const blacklistedTags = [...settings.tags, ...userSettings.tags]

  // Incrementally validate things to fail early when possible
  if (settings.sites.includes(site.domain)) {
    interaction.reply({
      content: `${site.domain} is blacklisted here.`,
      ephemeral: true,
    })
    return
  }

  if (userSettings.sites.includes(site.domain)) {
    interaction.reply({
      content: `${site.domain} is blacklisted in your settings.`,
      ephemeral: true,
    })
    return
  }

  const blacklistedTagsUsed = getTagsMatchingBlacklist(tags, blacklistedTags)

  if (blacklistedTagsUsed.length > 0) {
    interaction.reply({
      content: `Search contains blacklisted tags: ${codeBlock(
        formatTags(blacklistedTagsUsed),
      )}`,
      ephemeral: true,
    })
    return
  }

  const channel = await getInteractionChannel(interaction)
  // Keep NSFW out of non-NSFW channels
  const allowNSFW = await nsfwAllowedInChannel(
    channel,
    settings.config.allowNSFW,
  )

  if (!allowNSFW && getTagsMatchingBlacklist(tags, NSFW_RATINGS).length > 0) {
    interaction.reply({
      content: 'NSFW is not allowed in this channel.',
      ephemeral: true,
    })
    return
  }

  // Then search
  const defer = interaction.deferReply({ fetchReply: true, ephemeral })

  const startTime = process.hrtime.bigint()

  let results: Post[] | null = null

  try {
    results = await booru
      .search(site.domain, tags, {
        limit: 100,
        random: !hasOrderTag(tags),
      })
      // TODO: remove this once booru doesn't suck
      .then((res) => res.posts)
  } catch (e) {
    await defer
    interaction.editReply({
      content: `Error searching ${inlineCode(site.domain)}:\n${codeBlock(
        getErrorMessage(e),
      )}`,
    })
  }

  if (results === null) {
    await defer
    interaction.editReply({
      content: 'Search failed for an unknown reason. This should never happen.',
    })
    return
  }

  const endTime = process.hrtime.bigint()

  const posts = filterPosts(results, {
    minScore: settings.config.minScore,
    allowNSFW,
    blacklistTags: settings.tags,
  })

  if (posts.length === 0) {
    await defer

    if (results.length === 0) {
      interaction.editReply('No results found.')
    } else {
      interaction.editReply(
        `${results.length} results found, but were all filtered.`,
      )
    }

    return
  }

  const hiddenPostsCount = results.length - posts.length

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

  const postButton = new ButtonBuilder()
    .setCustomId(SEARCH_POST_PUBLICALLY)
    .setStyle(ButtonStyle.Primary)
    .setEmoji(SEARCH_POST_PUBLICALLY_EMOJI)
    .setLabel('Post Publically')

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    prevButton,
    hideButton,
    nextButton,
  ])

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
    hiddenPostsCount,
    timeTaken,
  })

  const message = await defer

  interaction.editReply({
    ...formattedPost,
    components: [row],
  })

  /** Posts that were already publically posted, to disable the button */
  const publicallyPostedPosts: string[] = []

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: IDLE_TIMEOUT,
  })

  // this uses closures so we can't extract it out :(
  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      i.reply({
        content:
          "You didn't initiate this search, so you can't interact with it.",
        ephemeral: true,
      })
      return
    }

    if (i.customId === SEARCH_POST_PUBLICALLY) {
      // Disable "Post publically" right after posting
      postButton.setDisabled(true)
      await i.update({
        components: [row],
      })

      const newPost = posts[postNumber - 1]
      const newFormattedPost = formatPostToEmbed({
        post: newPost,
        color,
      })
      publicallyPostedPosts.push(newPost.id)

      i.followUp({
        ...newFormattedPost,
        content: `Result posted by ${i.user}.`,
        allowedMentions: {
          parse: [],
        },
      })

      return
    }

    if (i.customId === SEARCH_HIDE) {
      hideButton.setEmoji(SEARCH_SHOW_EMOJI)
      hideButton.setCustomId(SEARCH_SHOW)
      i.update({
        content: `Current post hidden, click ${SEARCH_SHOW_EMOJI} to reveal.`,
        embeds: [],
        components: [row],
      })
      return
    }

    if (i.customId === SEARCH_PREV) {
      if (postNumber <= 1) {
        i.reply({ content: 'There is no previous post.', ephemeral: true })
        return
      }

      postNumber--
    }

    if (i.customId === SEARCH_NEXT) {
      if (postNumber >= postCount) {
        i.reply({ content: 'There is no next post.', ephemeral: true })
        return
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
    postButton.setDisabled(publicallyPostedPosts.includes(newPost.id))

    const newFormattedPost = formatPostToEmbed({
      post: newPost,
      color,
      postNumber,
      postCount,
      hiddenPostsCount,
      timeTaken,
    })

    i.update({
      ...newFormattedPost,
      components: [row],
    })
  })

  collector.on('end', async () => {
    interaction.editReply({ components: [] })
  })
}
