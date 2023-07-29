import { ButtonBuilder, ButtonStyle } from 'discord.js'
import { makeAutoreplyModule } from 'sleetcord-common'

const CHANGELOG_URL = 'https://github.com/AtoraSuunva/BooruBot/releases'
const SOURCE_URL = 'https://github.com/AtoraSuunva/BooruBot'
const WHY_SLASH_URL =
  'https://gist.github.com/AtoraSuunva/c55dd6c7e157eeb25c26ef09f47790d8'

const buttons: ButtonBuilder[] = [
  new ButtonBuilder()
    .setLabel('Changelog')
    .setStyle(ButtonStyle.Link)
    .setURL(CHANGELOG_URL),

  new ButtonBuilder()
    .setLabel('More Info & Source Code')
    .setStyle(ButtonStyle.Link)
    .setURL(SOURCE_URL),

  new ButtonBuilder()
    .setLabel('Why Slash Commands?')
    .setStyle(ButtonStyle.Link)
    .setURL(WHY_SLASH_URL),
]

export const autoreply = makeAutoreplyModule({
  buttons,
})
