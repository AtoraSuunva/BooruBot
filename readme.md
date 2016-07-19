#BooruBot

Random images from boorus!

Featuring a fully fleshed blacklist, with tag/channel/site blacklisting.

[Invite!](http://discordapp.com/oauth2/authorize?client_id=204721731162734592&scope=bot&permissions=0)

##Commands for all!

**=[site] {tags}** => A random image from [site] with {tags} (tags optional)

*site*: Either full url `safebooru.org` or alias `sb` (see [sites](sites.md))

*tags*: Tags separated with `,` (spaces are not allowed [use `_`])

**=blacklist** => View blacklist

**=avy** => Change avatar

**=invite** => Invite bot

**=help** => Get some help

##Blacklist

####Certain users only!

**=blacklist/whitelist [tag/channel/site] [thing]** => Edit blacklist

*tag*: Just put in a regular tag (`loli`)

*channel*: Mention a channel (`#general`)

*site*: Site url or alias (`e621.net`, `e6`)

(You can also use `=blacklist/whitelist all [sites/channels/sites/sfw/nsfw]`)

**=add/remove [mention]** => Add/Remove user from blacklist

###FAQ

####Can you add support/alias for (site)?
Ask me, and I'll try my best. Just note that I can't get images from a booru without an api.

~~If this gets popular I expect someone to ask for derpiboo.ru~~

####Can I use this code?
What are you? Suicidal?

Go ahead, but it's an absolute mess.

####Can I run the bot myself?
Sure. If you're worried about me logging/seeing your searches/messages, I'll let you know that I only log commands for the bot, and even then only to be able to debug more easily.

Also I don't think anything you would search would make me judge you because I've searched some weird stuff myself.

####Why can I only use 1 tag with danbooru?
I use `order:random` to get random images from danbooru, which unfortunately takes 1 out of 2 tags non gold/platinum users can use.

If people are willing to donate 20/40$ for gold/platinum, I'll set it up so you can search for 6/12 tags at a time.

####Embeds are disabled, can you make this bot upload the images instead of linking?
Maybe, if there's enough demand. But my pi can only take so much.

####>js >not python
I know I'm a pleb. But hey, it works, right?

###License
I really don't care. I'd just like if you gave me some credit if you used my code.
