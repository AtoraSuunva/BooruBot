//Core module, used to eval stuff for testing

module.exports.config = {
  name: 'eval',
  invokers: ['eval'],
  help: 'Evals stuff',
  expandedHelp:
    "Evals stuff for testing reasons.\nIf you try to use my eval I'll kinkshame you.",
  invisible: true,
}

const util = require('util')

module.exports.events = {}
module.exports.events.message = async (bot, message) => {
  const config = bot.sleet.config

  if (message.author.id !== config.owner.id) return

  const shlex = bot.sleet.shlex
  const modules = bot.sleet
  const Discord = require('discord.js')
  const fetch = require('node-fetch')

  let args = shlex(message.content)
  let evalMsg = message.content.substring(
    message.content.indexOf(args[0]) + args[0].length,
  )
  let output = 'aaa'
  let msg

  bot.sleet.logger.log(evalMsg)

  try {
    output = eval(evalMsg)

    if (output instanceof Promise) {
      msg = await message.channel.send('Waiting for Promise...')
      output = await output
    }

    const inspect = util.inspect(output, { depth: 1 })

    if (inspect.length > 2000) {
      return condEdit(message, msg, `Output is ${inspect.length} characters long.`)
    }

    output =
      '```js\n' +
      inspect
        .replace(
          bot.token,
          '[ ACCORDING TO ALL KNOWN LAWS OF DISCORD, THERE IS NO WAY AN EVAL SHOULD BE ABLE TO SHOW YOUR TOKEN ]',
        ) +
      '\n```'

    condEdit(message, msg, output)
  } catch (e) {
    bot.sleet.logger.warn(e)
    e.message = e.message.replace(bot.token, '[no token for you]')
    output = '```js\n' + e + '\n```'
    condEdit(message, msg, output)
  }
}

function condEdit(message, msg, content) {
  if (msg) msg.edit(content)
  else
    return message.channel.send(content, { _ext: 'js' })
}
