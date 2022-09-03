import Rollbar from 'rollbar'
import env from 'env-var'
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  CommandInteraction,
} from 'discord.js'
import { SleetModule } from 'sleetcord'

const NODE_ENV = env.get('NODE_ENV').required().asString()
const accessToken = env.get('ROLLBAR_ACCESS_TOKEN').asString()

const rollbar = new Rollbar({
  accessToken: accessToken ?? '',
  enabled: accessToken !== undefined,
  captureUncaught: true,
  captureUnhandledRejections: true,
  nodeSourceMaps: true,
  locals: Rollbar.Locals,

  payload: {
    environment: NODE_ENV,
    client: {
      javascript: {
        // TODO: some way to auto-upload source maps (unbuild? github action?)
        // source_map_enabled: true,
        // code_version: '448d5d86d689763d404a899f7e7aaa6398f8fb7b',
        guess_uncaught_frames: true,
      },
    },
  },
})

export const rollbarLogger = new SleetModule(
  {
    name: 'rollbarLogger',
  },
  {
    error: (error) => rollbar.error(error),
    autocompleteInteractionError: interactionErrorHandler,
    applicationInteractionError: interactionErrorHandler,
  },
)

function interactionErrorHandler(
  module: SleetModule,
  interaction: CommandInteraction | AutocompleteInteraction,
  error: unknown,
) {
  rollbar.error(error as Error, {
    module: module.name,
    interaction: interactionToString(interaction),
  })
}

const optionTypeToString: Record<ApplicationCommandOptionType, string> = {
  1: 'Subcommand',
  2: 'SubcommandGroup',
  3: 'String',
  4: 'Integer',
  5: 'Boolean',
  6: 'User',
  7: 'Channel',
  8: 'Role',
  9: 'Mentionable',
  10: 'Number',
  11: 'Attachment',
}

function interactionToString(
  interaction: CommandInteraction | AutocompleteInteraction,
): string {
  const name = interaction.commandName
  const options = interaction.options.data.map(
    (opt) =>
      `[${opt.name}${opt.focused ? '*' : ''}<${
        optionTypeToString[opt.type]
      }>: ${opt.value}]`,
  )

  return `/${name} ${options.join(' ')}`
}
