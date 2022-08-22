import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ClientUser,
  Message,
  OAuth2Scopes,
} from 'discord.js'
import { SleetModule } from 'sleetcord'

export const autoreply = new SleetModule(
  {
    name: 'autoreply',
  },
  {
    messageCreate: handleMessageCreate,
  },
)

let clientUserRegex: RegExp | null = null

const MORE_INFO_URL =
  'https://gist.github.com/AtoraSuunva/c55dd6c7e157eeb25c26ef09f47790d8'

function handleMessageCreate(message: Message): Promise<unknown> | void {
  if (message.author.bot) return

  const { client } = message
  const { user } = client

  if (user) {
    const userRegex = lazyInitClientUserRegex(user)

    if (userRegex.test(message.content)) {
      const inviteLink = client.generateInvite({
        scopes: client.application?.installParams?.scopes ?? [
          OAuth2Scopes.Bot,
          OAuth2Scopes.ApplicationsCommands,
        ],
      })

      const row = new ActionRowBuilder<ButtonBuilder>()
      const inviteButton = new ButtonBuilder()
        .setLabel('Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink)

      const whyButton = new ButtonBuilder()
        .setLabel('Why')
        .setStyle(ButtonStyle.Link)
        .setURL(MORE_INFO_URL)

      row.addComponents([inviteButton, whyButton])

      return message.reply({
        content: `Use slash commands to interact with me, type \`/\` into your chat bar to see them.\nDon't see them? Try reinviting me.`,
        components: [row],
      })
    }
  }
}

function lazyInitClientUserRegex(user: ClientUser): RegExp {
  return (clientUserRegex ??= new RegExp(`^<@!?${user.id}>$`))
}
