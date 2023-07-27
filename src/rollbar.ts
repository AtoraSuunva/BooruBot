import Rollbar from 'rollbar'
import env from 'env-var'
import { AutocompleteInteraction } from 'discord.js'
import { ApplicationInteraction, SleetModule } from 'sleetcord'
import { interactionToString } from './logging.js'

const NODE_ENV = env.get('NODE_ENV').required().asString()
const accessToken = env.get('ROLLBAR_ACCESS_TOKEN').asString()

export const rollbar = new Rollbar({
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
    error: (error) => void rollbar.error(error),
    autocompleteInteractionError: interactionErrorHandler,
    applicationInteractionError: interactionErrorHandler,
  },
)

function interactionErrorHandler(
  module: SleetModule,
  interaction: ApplicationInteraction | AutocompleteInteraction,
  error: unknown,
) {
  rollbar.error(error as Error, {
    module: module.name,
    interaction: interactionToString(interaction),
  })
}
