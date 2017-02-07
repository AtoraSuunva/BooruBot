//Deletes the last X images that the bot posted
//Useful if it pulls up an image you don't want to see

module.exports.config = {
  name: 'delete',
  invokers: ['delete', 'del', 'delet this'],
  help: 'Deletes images that the bot posted',
  expandedHelp: 'Deletes the last X images that the bot posted.\n\n**Usage:**:\n`delete` => Deletes last image\n`delete 4` => Deletes last 4 images\n\nUsers without "Manage Messages" perm can only delete 5 images at a time'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => { //TODO: Check for "MANAGE_MESSAGES" perm on the bot and use the bulk delete endpoint if available
  let args = bot.modules.shlex(message.content)
  let msgsToDelete = parseInt(args[1])

  if (Number.isNaN(msgsToDelete)) {
    if (message.channel.lastImagePosted === undefined) {
      message.channel.sendMessage('I don\'t have a message cached for this channel! You can still try `delete 1` and force me to search the last 50 messages')
      return;
    }

    message.channel.lastImagePosted.delete()
    .then(msg => message.channel.sendMessage('Deleted last image...'))
    .catch(err => message.channel.sendMessage('I don\'t have a message cached for this channel! You can still try `delete 1` and force me to search the last 50 messages'))
  } else if (msgsToDelete > 5 && !message.channel.permissionsFor(message.author).hasPermission('MANAGE_MESSAGES')) {
    message.channel.sendMessage('Whoa there, users without "Manage Messages" can only delete max 5 images at a time')
  } else {
    message.channel.fetchMessages({limit: 50})
    .then(msgs => {
      let delMsgs = msgs.filter(msg => {return msg.author.equals(bot.user)}).filter(msg => {return msg.embeds[0] !== undefined})
      let numMsgs = 0

      for (let msg of delMsgs) {
        msg[1].delete() //msg is an array with ['messageID', Message]
        numMsgs++
        if(--msgsToDelete <= 0) break
      }

      message.channel.sendMessage(`Deleted ${numMsgs} message${(numMsgs === 1) ? '' : 's'}...`)
    })
  }
}

module.exports.events.messageReactionAdd = (bot, react, user) => {
  let customEmote = (react.message.guild) ? new Map([['264246678347972610', '272782646407593986'],['211956704798048256', '269682750682955777']]).get(react.message.guild.id) || '0' : '0'

  if (react.emoji.name === '❌' && react.count >= 2 && react.me)
    react.message.edit({embed: {description: `Message deleted by ${user.username}#${user.discriminator}`}})

  if (react.emoji.id === customEmote && react.count >= 2 && react.me) //squares
    react.message.edit({embed: {description: `Message deleted by ${user.username}#${user.discriminator}`}})
}
