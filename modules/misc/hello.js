//Here's another, minimal example

module.exports.config = {
  name: 'hello',
  invokers: ['hello', 'h'],
  help: 'Says hi!',
  expandedHelp: 'It says hi. That\'s it. I wish it did my taxes though.',
  invisible: true
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  message.channel.send(`Hi ${message.author.username}!`)
}
