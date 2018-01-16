//these are all the docs for this right now kek

/* Here's an example test command to use with this module system
 *
 * The filename doesn't *need* to match the command, but it's better if it does
 */

//This will hold the config settings for this module
//If it's not here it will yell at you
module.exports.config = {
  //The name of the command, used to distinguish it from others
  name: 'test',

  //Added onto the global invoker, so if the invoker is 'r!' in config.json this command can be invoked by either 'r!test' or 'r!t'
  //The invoker(s) is only used if you listen for the "message" event
  //A "null" value will cause it to be called on every message, essentially ignoring any invoker check
  invokers: ['test', 't'],

  //help text to show when you call help
  help: 'A test command',

  //help text to show when you call help test
  expandedHelp: 'Wow look even more help!',

  //If true, this module won't show on the list when help is called
  //It's optional, by default it'll show
  invisible: true,

  //Another optional config, this will disable auto loading on bot start
  //If it's not present it will load when the bot starts
  //Useful if you want to only enable a command when needed
  autoLoad: true
}


//I need to do this or else js complains that events is undefined
module.exports.events = {}

//Adding an event is simple
//Simply add your function to
//module.exports.events.eventName

//eventName is any event discord.js supports

//Args are in the form (discordClient, eventArgs...)
//discordClient => The client created with "new Discord.client()"
//eventArgs     => The args sent by the event

module.exports.events.message = (bot, message) => {
  bot.modules.logger.log(message.content)

  message.channel.send(`Congrats! You found the test command!`)
}

//Here's an example with channelUpdate
//The args for the function are pretty much the same, just with "bot" added
module.exports.events.channelUpdate = (bot, oldChannel, newChannel) => {
  //newChannel.send('There\'s been an update here!')
}

//Finally, show off ready
module.exports.events.ready = (bot) => {
  bot.logger.info('I\'m ready!')
}
