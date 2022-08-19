import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ColorResolvable,
  ComponentType,
  EmbedBuilder,
  escapeMarkdown,
} from 'discord.js'
import { AutocompleteHandler, SleetSlashCommand } from 'sleetcord'
import { getMatchingSitesFor, getReferenceIdFor } from './utils.js'
import booru from 'booru'
import { default as Post } from 'booru/dist/structures/Post.js'
import { extname } from 'path'
import { BooruSettings, settingsCache } from './SettingsCache.js'

const autocompleteSiteWithBlacklist: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  const referenceId = getReferenceIdFor(interaction)
  const blacklist = await settingsCache.getSites(referenceId)
  return getMatchingSitesFor(value)
    .filter((site) => !blacklist.includes(site.domain))
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

  const site = sites[0]
  const tags = interaction.options.getString('tags') ?? []
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false
  const referenceId = getReferenceIdFor(interaction)

  const defer = interaction.deferReply({ fetchReply: true, ephemeral })

  const settings = await settingsCache.get(referenceId)

  if (settings.sites.includes(site.domain)) {
    await defer
    interaction.editReply({ content: 'That site is blacklisted.' })
    return
  }

  const startTime = process.hrtime.bigint()

  const results = await booru.search(site.domain, tags, {
    limit: 100,
    random: true,
  })

  const endTime = process.hrtime.bigint()

  const posts = filterPosts(results, settings)

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
    timeTaken,
  })

  const message = await defer

  interaction.editReply({
    ...formattedPost,
    components: [row],
  })

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: IDLE_TIMEOUT,
  })

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
      const newPost = posts[postNumber - 1]
      const newFormattedPost = formatPostToEmbed({
        post: newPost,
        color,
        postNumber,
        postCount,
        timeTaken,
      })

      i.reply(newFormattedPost)
      return
    }

    if (i.customId === SEARCH_HIDE) {
      hideButton.setEmoji(SEARCH_SHOW_EMOJI)
      hideButton.setCustomId(SEARCH_SHOW)
      i.update({
        content: `Results hidden, click ${SEARCH_SHOW_EMOJI} to reveal.`,
        embeds: [],
        components: [row],
      })
      return
    }

    if (i.customId === SEARCH_PREV) {
      if (postNumber <= 1) {
        i.reply({ content: 'There is no previous post', ephemeral: true })
        return
      }

      postNumber--
    }

    if (i.customId === SEARCH_NEXT) {
      if (postNumber >= postCount) {
        i.reply({ content: 'There is no next post', ephemeral: true })
        return
      }

      postNumber++
    }

    // SEARCH_SHOW will fall through to here and this updates the buttons right
    // also means prev/next will correctly reset back to "hide" button
    hideButton.setEmoji(SEARCH_HIDE_EMOJI)
    hideButton.setCustomId(SEARCH_HIDE)
    prevButton.setDisabled(postNumber <= 1)
    nextButton.setDisabled(postNumber >= postCount)

    const newPost = posts[postNumber - 1]
    const newFormattedPost = formatPostToEmbed({
      post: newPost,
      color,
      postNumber,
      postCount,
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

// ---------------------

function filterPosts(posts: Post[], { config, tags }: BooruSettings) {
  return posts.filter(
    (post) =>
      (config.minScore === null || post.score >= config.minScore) &&
      !matchesBlacklist(post.tags, tags),
  )
}

function matchesBlacklist(tags: string[], blacklist: string[]): boolean {
  return blacklist.some((blacklistedTag) => tags.includes(blacklistedTag))
}

/**
 * Check if an extension is embedable inside of an embed (`.setImage`)
 * @param ext The extension to check for.
 * @returns If the extension is embedable in an embed
 */
function isEmbedableFileType(ext: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext)
}

function notEmpty(str: string): boolean {
  return str.trim() !== ''
}

/** This regex will match up to 75 characters, then cleanly end the match at the next `,`, up to a max of 100 characters total */
const regexCutTags = /[\S\s]{1,75}[^,]{0,25}/

function formatTags(tags: string[]): string {
  const tagString = tags.join(', ')

  if (tagString.length < 100) {
    return tagString
  }

  const tagCutMatch = tagString.match(regexCutTags) ?? []
  return `${escapeMarkdown(tagCutMatch[0])}...`
}

function formatTime(time: bigint): string {
  return `${(Number(time) / 1e6).toFixed(2)}ms`
}

interface PostFormatOptions {
  post: Post
  color?: ColorResolvable | null
  timeTaken?: bigint
  postNumber?: number
  postCount?: number
}

interface FormattedPost {
  embeds: EmbedBuilder[]
}

function formatPostToEmbed({
  post,
  color = '#34363C',
  timeTaken,
  postNumber,
  postCount,
}: PostFormatOptions): FormattedPost {
  const ext = extname(post.fileUrl ?? '').toLowerCase()

  const embedable = !isEmbedableFileType(ext)
    ? '*The file will likely not embed*'
    : ''

  const leadingDescription = [
    `**Score:** ${post.score}`,
    `**Rating:** ${post.rating}`,
    `[File](${post.fileUrl})`,
    ext,
  ].join(' | ')

  const description = [
    leadingDescription,
    `**Tags:** ${formatTags(post.tags)}`,
    embedable,
  ]
    .filter(notEmpty)
    .join('\n')

  const footerText = [
    post.booru.domain,
    postNumber ? `${postNumber}/${postCount || postNumber}` : '',
    timeTaken ? formatTime(timeTaken) : '',
  ]
    .filter(notEmpty)
    .join(' · ')

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Post #${post.id}`)
    .setURL(post.postView)
    .setDescription(description)
    .setImage(post.fileUrl)
    .setFooter({
      text: footerText,
      iconURL: `https://${post.booru.domain}/favicon.ico`,
    })

  return {
    embeds: [embed],
  }
}
