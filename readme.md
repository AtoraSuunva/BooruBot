# BooruBot v3 (Beta!)

A complete rewrite of BooruBot because the old code sucked.

Does the same things as the old BooruBot, but better.

Detailed changelog [here](https://github.com/AtlasTheBot/Booru-Discord/issues/14)

#### Features:
* Tag/Site blacklist
* Can be restricted to only search in certain channels
* NSFW in nsfw channels only (Unless you mark the entire server as nsfw with `b!set nsfwServer true`)
* Support for [16 sites](./sites.md)
* Ability to randomly search all sites
* Command to delete images the bot posted to shield your eyes
* Uses fancy embeds! (With fallbacks in case embeds are disabled)
* Some other stuff I forgot

# [Invite!](https://discordapp.com/oauth2/authorize?client_id=204721731162734592&scope=bot&permissions=0)

---

### Commands

Things in between `[]` are required, things in between `<>` are optional.
Also don't include `[]` and `<>` in the commands themselves.

| Command | Description | Aliases |
| ------- | ----------- | ------- |
| `b!help <command>` | Get a list of commands or display help for a specific command | None
| `b!search [site] <tag1> <tag2> <tagn>` | Search some boorus! Add as many (or as little) tags as you want, seperated by spaces | `s`, The name of the booru (`b!sb cat`)
| `b!link [url]` | Takes a url to a post on a booru and creates an embed from it | `ln`
| `b!sites` | Posts a link to all supported sites | None
| `b!delete <x>` | Deletes the last image, or the last x images | `del`, `delet this`
| `b!invite <"server">` | Posts an invite link for BooruBot in chat, or the link to the support server in DMs | None
| `b!ping` | Pong! Displays BooruBot's ping | None
| `b!stats` | Some stats about the bot | None
| `b!info` | Some info about the bot | None
| `b!settings <setting>` | View the current settings for this server or info about a setting | `set`, `setting`, `seting`
| `b!blacklist` | View the current blacklist | `bl`

`b!sites` supports `r`, `rand` or `random` as a site! It will keep searching through sites until it finds an image or runs out of sites!

#### Mod Commands

These commands require special perms and are not usable by all server members.

| Command | Description | Aliases |
| ------- | ----------- | ------- |
| `b!settings <setting> <newValue>` | **[Manage Guild]**: Allows you to modify settings | `set`, `setting`, `seting`
| `b!blacklist <"tag" or "site"> <thing to blacklist>` | **[Manage Messages]**: Allows you to blacklist a tag/site. You don't need to put the full site url to blacklist it, site aliases are supported | `bl`
| `b!whitelist ["tag" or "site"] [thing to whitelist]` | **[Manage Messages]**: Allows you to remove a tag/site from the blacklist | `wl`

Note about the blacklist:
* Applies per server
* Users cannot search using blacklisted tags or sites
* `r`, `rand` and `random` won't use blacklisted sites
* You can use `all` to blacklist all sites or whitelist all sites/tags (`b!bl sites all`, `b!wl tags all`)
* You can replace `all` with `nsfw` or `sfw` to blacklist/whitelist all nsfw/sfw sites too

---

### FAQ

#### Can you add support/alias for (site)?
Ask me, and I'll try my best. Just note that I can't get images from a booru without an api. Be sure to check the site list to see if I haven't tried to support it already.

#### Can I use this code?
Sure! You can either host it yourself or fork it or extend it or...

#### Can I run the bot myself?
Feel free to, although you might run into a few issues for some manual configuration stuff (Although I tried to avoid that!)

---

### License
I really don't care. I'd just like if you gave me some credit if you used my code.
