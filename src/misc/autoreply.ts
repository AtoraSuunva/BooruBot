import { ClientUser, Message, OAuth2Scopes } from 'discord.js'
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

function handleMessageCreate(message: Message): Promise<unknown> | void {
  if (message.author.bot) return

  const { client } = message
  const { user } = client

  if (user) {
    const userRegex = lazyInitClientUserRegex(user)
    const inviteLink = client.generateInvite({
      scopes: client.application?.installParams?.scopes ?? [
        OAuth2Scopes.Bot,
        OAuth2Scopes.ApplicationsCommands,
      ],
    })

    if (userRegex.test(message.content)) {
      return message.reply({
        content: `Use slash commands to interact with me, type \`/\` into your chat bar to see them.\nDon't see them? Try kicking me and reinviting me.\n${inviteLink}`,
      })
    }
  }
}

function lazyInitClientUserRegex(user: ClientUser): RegExp {
  return (clientUserRegex ??= new RegExp(`^<@!?${user.id}>$`))
}
