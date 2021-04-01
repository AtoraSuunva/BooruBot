//Core module, used to eval stuff for testing

module.exports.config = {
  name: 'eval',
  invokers: ['eval', 'eval!', 'eval?'],
  help: 'Evals stuff',
  expandedHelp:
    "Evals stuff for testing reasons.\nIf you try to use my eval I'll kinkshame you.",
  invisible: true,
}

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

  console.log(message.content)
  console.log(args)

  bot.sleet.logger.log(evalMsg)

  try {
    output = eval(evalMsg)

    if (output instanceof Promise) {
      msg = await message.channel.send('Waiting for Promise...')
      output = await output
    }

    if (args[0] === 'eval?') bot.sleet.logger.log(msg)
    let length = require('util').inspect(output, { depth: 2 }).length

    if (length > 2000 && args[0] !== 'eval!' && args[0] !== 'eval...')
      return condEdit(
        message,
        msg,
        `Message is ${length} chars long, use \`eval!\` to dump anyways.`,
      )
    else
      output =
        '```js\n' +
        require('util')
          .inspect(output, { depth: 2 })
          .replace(
            bot.token,
            '[ ACCORDING TO ALL KNOWN LAWS OF DISCORD, THERE IS NO WAY AN EVAL SHOULD BE ABLE TO SHOW YOUR TOKEN ]',
          ) +
        '\n```'

    if (args[0] !== 'eval...') condEdit(message, msg, output)
  } catch (e) {
    bot.sleet.logger.warn(e)
    e.message = e.message.replace(bot.token, '[no token for you]')

    let length = e.message.length
    if (length > 2000 && args[0] !== 'eval!')
      return condEdit(
        message,
        msg,
        `Error over 2k characters (congrats on ${length} chars), use \`eval!\` to dump everything.`,
      )
    else output = '```js\n' + e + '\n```'

    condEdit(message, msg, output)
  }
}

function condEdit(message, msg, content) {
  if (msg) msg.edit(content)
  else
    return message.channel.send(content, {
      split: { prepend: '```', append: '```' },
    })
}
