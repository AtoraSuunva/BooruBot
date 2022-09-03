import type { default as Post } from 'booru/dist/structures/Post.js'
import {
  escapeMarkdown,
  ColorResolvable,
  EmbedBuilder,
  AnyThreadChannel,
  ChannelType,
  CommandInteraction,
  NewsChannel,
  TextBasedChannel,
  TextChannel,
} from 'discord.js'
import { extname } from 'path'

/**
 * Get the channel that a slash command was called in
 * @param interaction The interaction to fetch the channel for
 * @returns The channel the interaction was called in
 */
export async function getInteractionChannel(
  interaction: CommandInteraction,
): Promise<TextBasedChannel> {
  if (interaction.channel) {
    return interaction.channel
  }

  const channel = await interaction.client.channels.fetch(interaction.channelId)

  if (channel && channel.isTextBased()) {
    return channel
  }

  throw new Error(
    `Could not find channel ${interaction.channelId} for interaction ${interaction.id}`,
  )
}

/**
 * Get the parent channel of a thread, since this is somehow actually complicated to handle
 * @param thread The thread to get the parent channel for
 * @returns The parent channel of the thread
 */
export async function getParentChannel(
  thread: AnyThreadChannel,
): Promise<NewsChannel | TextChannel> {
  if (thread.parent) {
    return thread.parent
  }

  let { parentId } = thread // Starting a thread without a message returns null parent ID (???? ????)

  if (parentId == null) {
    const threadChannel = await thread.guild.channels.fetch(thread.id)
    if (threadChannel === null || threadChannel.parentId === null) {
      throw new Error(
        `Thread ${thread.id} has no parent ID even after fetching the thread, give up`,
      )
    }

    parentId = threadChannel.parentId
  }

  const parent = await thread.guild.channels.fetch(parentId)

  if (!parent) {
    throw new Error(`Thread ${thread.id} has no parent channel?`)
  }

  if (
    parent.type === ChannelType.GuildNews ||
    parent.type === ChannelType.GuildText
  ) {
    return parent
  } else {
    throw new Error(
      `Thread ${thread.id} has an unexpected parent channel type ${parent.type}`,
    )
  }
}

export async function nsfwAllowedInChannel(
  channel: TextBasedChannel,
  allowNSFW: boolean,
): Promise<boolean> {
  // There are 3 cases:
  //   - We're in a DM, which can't be age-restricted
  //      - In this case, we'll fall back to a `allowNSFW` config option
  //   - We're in a thread, where the *parent* channel can be age-restricted or not
  //      - Check if allowNSFW, then check parent channel
  //   - We're in a text guild channel (regular, news, voice) which can be age-restricted or not
  //      - Check if allowNSFW, then check channel

  // false = disable *everywhere*
  if (allowNSFW === false) {
    return false
  }

  // true = enable in DMs or age-restricted channels
  if (channel.isDMBased()) {
    return allowNSFW
  } else if (channel.isThread()) {
    // Already checked allowNSFW, check parent channel
    return await getParentChannel(channel).then((parent) => parent.nsfw)
  } else {
    // Already checked allowNSFW, check channel
    return channel.nsfw
  }
}

/**
 * Settings that apply for this specific invocation
 */
interface ContextSettings {
  minScore: number | null
  allowNSFW: boolean
  blacklistedTags: string[]
}

export function filterPosts(
  posts: Post[],
  { minScore, allowNSFW, blacklistedTags }: ContextSettings,
) {
  return posts.filter(
    (post) =>
      post.fileUrl &&
      post.available &&
      (minScore === null || post.score >= minScore) &&
      (allowNSFW || !isNSFWPost(post)) &&
      !postMatchesBlacklist(post, blacklistedTags),
  )
}

/**
 * Check if a post is considered NSFW by checking the rating
 * @param post The post to check
 * @returns Is the post considered NSFW?
 */
function isNSFWPost(post: Post): boolean {
  return post.rating !== 's'
}

const EXPANDED_RATINGS = {
  s: 'safe',
  q: 'questionable',
  e: 'explicit',
  u: 'unrated',
} as const

type RatingLetter = keyof typeof EXPANDED_RATINGS

export const NSFW_RATINGS = ['q', 'e', 'u'].flatMap((r) => [
  `rating:${r}`,
  `rating:${EXPANDED_RATINGS[r as RatingLetter]}`,
])

export function postMatchesBlacklist(post: Post, blacklist: string[]): boolean {
  // Check rating
  const ratings = [
    `rating:${post.rating}`,
    `rating:${EXPANDED_RATINGS[post.rating as RatingLetter]}`,
  ]

  // Check filetype
  const filetype = `type:${extname(post.fileUrl ?? '').slice(1)}`

  // Check tags
  const finalTags = [...ratings, filetype, ...post.tags]

  return finalTags.some((tag) => compareTagAgainstBlacklist(tag, blacklist))
}

/**
 * List all tags that match a given blacklist
 * @param tags Tags to compare against the blacklist
 * @param blacklist The blacklist to compare against
 * @returns All tags that matched the blacklist
 */
export function getTagsMatchingBlacklist(
  tags: string[],
  blacklist: string[],
): string[] {
  // Get all matches
  return tags.filter((tag) => compareTagAgainstBlacklist(tag, blacklist))
}

/**
 * Compares a tag against a blacklist, returning if it matched
 * @param tag The tag to compare against the blacklist
 * @param blacklist The blacklist to compare against
 * @returns If the tag matched the blacklist
 */
function compareTagAgainstBlacklist(tag: string, blacklist: string[]): boolean {
  const lowerTag = tag.toLowerCase()
  return blacklist.includes(lowerTag)
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

export function formatTags(tags: string[]): string {
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
  hiddenPostsCount?: number
  appendContent?: string
}

interface FormattedPost {
  content: string | null
  embeds: EmbedBuilder[]
}

export function formatPostToEmbed({
  post,
  color = '#34363C',
  timeTaken,
  postNumber,
  postCount,
  hiddenPostsCount = 0,
  appendContent = '',
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

  const content =
    hiddenPostsCount > 0
      ? `${hiddenPostsCount} hidden ${pluralize('post', hiddenPostsCount)}.`
      : ''

  return {
    content: `${content}${appendContent}`.trim(),
    embeds: [embed],
  }
}

const ORDER_TAGS = ['order:', 'sort:'] as const
export function hasOrderTag(tags: string[]): boolean {
  return ORDER_TAGS.some((ot) => tags.some((tag) => tag.startsWith(ot)))
}

function pluralize(str: string, count: number, plural?: string): string {
  return count === 1 ? str : plural ?? `${str}s`
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message
  }

  return String(e)
}
