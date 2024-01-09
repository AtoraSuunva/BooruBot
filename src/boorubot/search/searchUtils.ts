import { Post } from 'booru'
import {
  AnyThreadChannel,
  AutocompleteInteraction,
  ChannelType,
  ColorResolvable,
  CommandInteraction,
  EmbedBuilder,
  ForumChannel,
  MediaChannel,
  NewsChannel,
  TextBasedChannel,
  TextChannel,
  escapeMarkdown,
} from 'discord.js'
import { extname } from 'path'

/**
 * Get the channel that a slash command was called in, for threads, this is the parent channel
 * @param interaction The interaction to fetch the channel for
 * @returns The channel the interaction was called in
 */
export async function getInteractionChannel(
  interaction: CommandInteraction | AutocompleteInteraction,
): Promise<TextBasedChannel> {
  const channel =
    interaction.channel ??
    (await interaction.client.channels.fetch(interaction.channelId))

  if (channel) {
    if (channel.isThread()) {
      const parent = await getParentChannel(channel)

      if (parent.isTextBased()) {
        return parent
      }
    } else if (channel.isTextBased()) {
      return channel
    }
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
): Promise<NewsChannel | TextChannel | ForumChannel | MediaChannel> {
  if (thread.parent) {
    return thread.parent
  }

  let { parentId } = thread // Starting a thread without a message returns null parent ID (???? ????)

  if (parentId == null) {
    const threadChannel = await thread.guild.channels.fetch(thread.id)
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
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
  if (!allowNSFW) {
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

interface FilteredPost {
  post: Post
  reason: string
}

interface FilterResults {
  posts: Post[]
  filtered: FilteredPost[]
}

export function filterPosts(
  posts: Post[],
  { minScore, allowNSFW, blacklistedTags }: ContextSettings,
): FilterResults {
  const passing: Post[] = []
  const filtered: FilteredPost[] = []

  for (const post of posts) {
    if (!post.fileUrl) {
      filtered.push({ post, reason: 'No file URL' })
    } else if (!post.available) {
      filtered.push({ post, reason: 'Unavailable' })
    } else if (minScore !== null && post.score < minScore) {
      filtered.push({ post, reason: `Score below ${minScore}` })
    } else if (!allowNSFW && isNSFWPost(post)) {
      filtered.push({ post, reason: 'NSFW' })
    } else if (postMatchesBlacklist(post, blacklistedTags)) {
      filtered.push({ post, reason: 'Blacklisted tags' })
    } else {
      passing.push(post)
    }
  }

  return { posts: passing, filtered }
}

export function formatFilteredPosts(filteredPosts: FilteredPost[]): string {
  return Array.from(
    filteredPosts
      .reduce(
        (acc, { reason }) => acc.set(reason, (acc.get(reason) ?? 0) + 1),
        new Map<string, number>(),
      )
      .entries(),
  )
    .map(([reason, count]) => `${count}: ${reason}`)
    .join(', ')
}

/**
 * Check if a post is considered NSFW by checking the rating
 * @param post The post to check
 * @returns Is the post considered NSFW?
 */
function isNSFWPost(post: Post): boolean {
  return !['s', 'g'].includes(post.rating)
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
 * Check if an extension is embeddable inside of an embed (`.setImage`)
 * @param ext The extension to check for.
 * @returns If the extension is embeddable in an embed
 */
function isEmbeddableFileType(ext: string): boolean {
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
  return `${escapeMarkdown(tagCutMatch[0] ?? '')}...`
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
  filteredPosts?: FilteredPost[]
  appendContent?: string
  tags?: string[]
  defaultTags?: string[]
}

interface FormattedPost {
  content: string | null
  embeds: EmbedBuilder[]
}

const ratingEmojis: Record<string, string | undefined> = {
  s: '<:rating_safe:1194080016779202610>',
  g: '<:rating_general:1194080014413615216>',
  q: '<:rating_questionable:1194080015353127023>',
  e: '<:rating_explicit:1194080012769431645>',
  u: '<:rating_unknown:1194080018536603669>',
}

function formatRating(rating: string): string {
  return ratingEmojis[rating] ?? rating.toUpperCase()
}

function formatScore(score: number): string {
  if (score > 0) {
    return `<:green_arrow_up:1194080011330801744> ${score}`
  } else if (score < 0) {
    return `<:red_arrow_down:1194080019719401603> ${score}`
  } else {
    return `<:yellow_tilde:1194080020956729364> ${score}`
  }
}

export function formatPostToEmbed({
  post,
  color = '#34363C',
  timeTaken,
  postNumber,
  postCount,
  filteredPosts = [],
  appendContent = '',
  tags = [],
  defaultTags = [],
}: PostFormatOptions): FormattedPost {
  const ext = extname(post.fileUrl ?? '').toLowerCase()

  const embeddable = !isEmbeddableFileType(ext)
    ? '*The file will likely not embed*'
    : ''

  const leadingDescription = [
    `**Score:** ${formatScore(post.score)}`,
    `**Rating:** ${formatRating(post.rating)}`,
    `[File URL](${post.fileUrl})`,
    `\`${ext}\``,
  ].join(' | ')

  const description = [
    leadingDescription,
    `**Tags:** ${formatTags(post.tags)}`,
    embeddable,
  ]
    .filter(notEmpty)
    .join('\n')

  const footerText = [
    post.booru.domain,
    postNumber ? `${postNumber}/${postCount ?? postNumber}` : '',
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

  const tagLine = [
    tags.length > 0 ? `**Tags:** ${formatTags(tags)}` : '',
    defaultTags.length > 0
      ? `**Default Tags:** ${formatTags(defaultTags)}`
      : '',
  ]
    .filter((v) => v !== '')
    .join(' + ')

  const filterCount = filteredPosts.length
  const reasonCount = formatFilteredPosts(filteredPosts)

  const hiddenCount =
    filterCount > 0
      ? `${filterCount} hidden ${pluralize(
          'post',
          filterCount,
        )} (${reasonCount})`
      : ''

  const content = [tagLine, hiddenCount].filter((v) => v !== '').join('\n')

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
