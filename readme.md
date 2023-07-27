# Booru Bot

Search 15 different boorus directly from within Discord!

# [Add to Server](https://canary.discord.com/api/oauth2/authorize?client_id=204721731162734592&permissions=0&scope=bot%20applications.commands)

[Support Server](https://discord.gg/8K3uCfb) - [Privacy Policy](./privacy.md) - [Terms of Service](./tos.md)

# **Features:**

  - Tag/Site blacklist (server-wide and personal per-user lists)
  - NSFW in age-restricted channels **only** (See below on how to opt-in for DMs or opt-out for servers)
  - Support for 15 sites
  - Ability to randomly search all sites until you get a result
  - Configurable minimum score a post needs to be shown! Filter out posts with a negative score!
  - Uses fancy embeds!
  - Previous/Next buttons to look through all the results (up to 100!)
  - "Hide post" ❌ button to hide the image if it's... not great!
  - Search privately with ephemeral results! "Post Publicly" button once you find what you want to show everyone!
  - Open source!

Use `/search` for the main bot functionality, and use `/config` and `/blacklist` to manage the bot

# **Opting into NSFW**

By default, NSFW results (posts not rated `safe`) are *only* shown in age-restricted channels, not anywhere else (including DMs).

If you want to **opt-out** of NSFW results _anywhere_ on your server, run `/config set allow_nsfw allow:False` (You will need "Manage Messages" permissions or an override)

If you want to **opt-in** to NSFW results _in DMs_, run `/config set allow_nsfw allow:True` in a DM with the bot

NSFW results will **never** be posted in non age-restricted channels, regardless of your settings. If you want NSFW results in a channel, mark it age-restricted.

> ⚠️ NSFW filtering depends on the rating the booru gave the post. There is always a chance someone marked the post wrong and you get a non-safe post.

# **Managing the blacklist**

> ℹ️ Running these commands in-server will manage that server's blacklist, while running them in-DM will manage your _personal_ blacklist.
> When you search in a server, the server blacklist and your personal blacklist are merged together to filter the results

Use the `/blacklist` command to view/edit/delete the blacklist. See the subcommands for what exactly you can do. You'll need "Manage Messages" to use these commands.

Use `/view blacklist` to view the blacklist without any permissions.

---

### FAQ

#### Can you add support/alias for (site)?
Booru support is done using the [booru](https://github.com/AtoraSuunva/booru) package. I maintain that package so you are welcome to suggest (or even implement yourself) sites to support. (Preferably open an [issue on booru](https://github.com/AtoraSuunva/booru/issues), but I can forward requests there as well)

#### I have a bug report/idea/feedback...
Feel free to report/ask/post in the support server

#### Can I use/fork this code?
It's MIT licensed, go for it

#### Can I run the bot myself?
Sure, although you're responsible for keeping it maintained (I make no guarantees)

---

### Selfhosting

> ⚠️ ***I make no guarantees about anything if you selfhost the bot.*** You _will_ be on your own. I might help you if you're stuck, but **I do not officially provide support for selfhosting.** Don't do this unless you know what you're doing. You revoke all right to complain if something goes wrong when you selfhost if you selfhost.

You're free to host the bot yourself, but it requires some dev knowledge:

  * I have no idea what the minimum required node.js version is, but v18.3.0 worked for me
  * You'll need a bot user set up, [see here](https://discord.com/developers/applications)
  * You'll need a `.env` file:

```toml
NODE_ENV=development # or production
TOKEN=<discord bot token>
APPLICATION_ID=<discord application id>
USE_PINO_PRETTY=true # or false for default pino logs
DATABASE_URL="file:./db/dev.db" # or anywhere else you want an sqlite db to be
ACTIVITIES_FILE="./resources/activities-smol.txt" # path to a text file with the activities you want the bot to show
```

Then:

Docker (recommended) can also be used, automatically building, migrating, and running. The default docker setup will use an sqlite file, you will have to modify it (and your docker network) to work with an external DB
```sh
docker-compose up
```

```sh
# Install dependencies (pnpm is used, but npm/yarn also work)
pnpm install

# Migrate the database if needed
pnpm prisma migrate deploy

# Run in dev mode
pnpm run start:dev

#  - OR -

# Build the bot & run in production mode
pnpm run build
pnpm run start:prod
```

---

### License
It's MIT, aka "do whatever you want just include this license and don't hold me liable if it becomes sentient"
