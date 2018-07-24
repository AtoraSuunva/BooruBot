module.exports.config = {
  name: 'update',
  invokers: ['update'],
  help: 'Check what\'s new in BB v3',
  expandedHelp: 'Use the command and find out!'
}

module.exports.events = {}
module.exports.events.message = (bot, message) => {
  message.channel.send(
`
I've updated BooruBot by doing a big overhaul.
It should be several times nicer to use (and maintain), plus comes with some improvements

**tl;dr of changes:**

* Invoker changed from \`=\` to \`b!\` since \`=\` conflicted with way too many bots.
* Bot supports edits + deletes it's message if you delete yours
* Code is prettier
* Added e926.net/deribooru.org
* Removed channel blacklisting, now you need to enable \`topicEnable\` and put \`bb=true\` in the topics of channels you want to use BooruBot's search in
* nsfw images in nsfw channels only (Unless you set \`nsfwServer\` to \`true\`)
* Pictures posted as rich embeds!
* Delete pictures with reactions or by using \`b!delete\`

Full changelog here: <https:\/\/github.com/AtlasTheBot/Booru-Discord/issues/14>
`.trim())
}

module.exports.events.ready = bot => {
  bot.user.setPresence({game: {name: 'Try b!update | b!help', type: 0}})
}
