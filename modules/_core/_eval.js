//Core module, used to eval stuff for testing

module.exports.config = {
  name: 'eval',
  invokers: ['eval', 'eval!'],
  help: 'Evals stuff',
  expandedHelp: 'Evals stuff for testing reasons.\nIf you try to use my eval I\'ll kinkshame you.',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  const config = bot.modules.config
  if (message.author.id !== config.owner.id) return;

  const shlex = bot.modules.shlex
  const moduleSys = bot.modules
  const Discord = require('discord.js')

  let args = shlex(message.content)
  let evalMsg = message.content.substring(message.content.indexOf(args[0]) + args[0].length)


  console.log(evalMsg)

  try {
    let msg = eval(evalMsg)
    console.log(msg)
    let length = require('util').inspect(msg, { depth: null }).length
    if (length > 2000 && args[0] !== 'eval!') return message.channel.send(`Result over 2k characters (${length} chars), use \`eval!\` to dump everything.`)
    message.channel.sendMessage('```js\n' + require('util').inspect(msg, { depth: null }) + '\n```', {split: {prepend: '```js\n', append: '\n```'}}).catch(console.log)
  } catch (e) {
    console.log(e)
    let length = e.message.length
    if (length > 2000 && args[0] !== 'eval!') return message.channel.send(`Result over 2k characters (congrats on ${length} chars), use \`eval!\` to dump everything.`)
    message.channel.sendMessage('```js\n' +  e  + '\n```', {split: {prepend: '```js\n', append: '\n```'}}).catch(console.log)
  }

}
