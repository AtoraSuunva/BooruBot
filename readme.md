# Booru Bot

Search 15 different boorus directly from within Discord!

## [Add to Server](https://canary.discord.com/api/oauth2/authorize?client_id=204721731162734592&permissions=0&scope=bot%20applications.commands)

[Support Server](https://discord.gg/8K3uCfb) - [Privacy Policy](./privacy.md) - [Terms of Service](./tos.md)

## **Features:**

- Tag/Site blacklist
  - Server-wide,
  - Per-channel,
  - and per-user blacklist!
  - Hide results across the whole server, or only in certain channels, or create your own personal blacklist (in DMs) that applies to any search you do _anywhere_!
- NSFW in age-restricted channels **only** (See below on how to opt-in for DMs or opt-out for servers)
- Support for 15 sites
- Ability to randomly search all sites until you get a result
- Configurable!
  - Minimum score a post needs to be shown! Filter out posts with a negative score!
  - Disable NSFW everywhere, even in age-restricted channels!
  - Default tags! Apply `rating:s` to all your searches instead of getting 70 filtered results!
  - Configs can be done per-channel! Merged with guild configs so you can be more (or less) strict in certain channels! Use the `channel:` option for per-channel configs.
- Uses fancy embeds!
- Previous/Next buttons to look through all the results (up to 100!)
- "Hide post" ❌ button to hide the image if it's... not great!
- Search privately with ephemeral results! "Post Publicly" button once you find what you want to show everyone!
- Open source!

Use `/search` for the main bot functionality, and use `/config` and `/blacklist` to manage the bot

## **Opting into NSFW**

By default, NSFW results (posts not rated `safe`) are _only_ shown in age-restricted channels, not anywhere else (including DMs).

If you want to **opt-out** of NSFW results _anywhere_ on your server, run `/config set allow_nsfw allow:False` (You will need "Manage Messages" permissions or an override)

If you want to **opt-in** to NSFW results _in DMs_, run `/config set allow_nsfw allow:True` in a DM with the bot

NSFW results will **never** be posted in non age-restricted channels, regardless of your settings. If you want NSFW results in a channel, mark it age-restricted.

> ⚠️ NSFW filtering depends on the rating the booru gave the post. There is always a chance someone marked the post wrong and you get a non-safe post.

## **Managing the blacklist**

> ℹ️ Running these commands in-server will manage that server's blacklist, while running them in-DM will manage your _personal_ blacklist.
> When you search in a server, the server blacklist, channel blacklist, and your personal blacklist are merged together to filter the results

Use the `/blacklist` command to view/edit/delete the blacklist. See the subcommands for what exactly you can do. You'll need "Manage Messages" to use these commands.

Use the `channel:` option to manage the blacklist of a specific channel.

Use `/view blacklist` to view the blacklist without any permissions.

---

## FAQ

### Can you add support/alias for (site)?

Booru support is done using the [booru](https://github.com/AtoraSuunva/booru) package. I maintain that package so you are welcome to suggest (or even implement yourself) sites to support. (Preferably open an [issue on booru](https://github.com/AtoraSuunva/booru/issues/new), but I can forward requests there as well)

### I have a bug report/idea/feedback/etc

You can submit it either as an [issue here](https://github.com/AtoraSuunva/BooruBot/issues/new) or on the [Support Server](https://discord.gg/8K3uCfb)

### Can I use/fork this code?

It's MIT licensed, go for it

---

## Selfhosting

> ⚠️ _**I make no guarantees about anything if you selfhost the bot.**_ You _will_ be on your own. I might help you if you're stuck, but **I do not officially provide support for selfhosting.** Don't do this unless you know what you're doing. You revoke all right to complain if something goes wrong when you selfhost if you selfhost.

You can either run the bot via the pre-built Docker image, Docker, or installing the dependencies yourself.

### .env Requirements

```ini
NODE_ENV=development # or production
TOKEN=<discord bot token>
APPLICATION_ID=<discord application id>
USE_PINO_PRETTY=true # or false for default pino logs
DATABASE_URL="file:./db/data.db" # or anywhere else you want an sqlite db to be
ACTIVITIES_FILE="./resources/activities-boorubot.txt" # path to a text file with the activities you want the bot to show
HEALTHCHECK_PORT=8000 # the port to run an http server on, which will respond to http://localhost:PORT/healthcheck with HTTP 200 once the bot is ready and the database works
SENTRY_DSN=<access token> # A sentry DSN for error reporting, optional

# API Keys, you should provide these are JSON objects that will be mapped to query params.
# When I get around to updating booru to properly handle auth it will also map this to Authorization
# Headers instead of query params on boorus that support it

# Required API Keys, these boorus will NOT work without API keys!
# You can omit this and the bot will still work, but searches on this booru will not work
GELBOORU_API_KEY='{"api_key":"gelbooru_dummy_key", "user_id": "123456789"}'
RULE34XXX_API_KEY='{"api_key":"rule34xxx_dummy_key", "user_id": "123456789"}'

# Optional API keys, these boorus work without API keys:
; DANBOORU_API_KEY='{"api_key": "danbooru_dummy_key", "login": "Your_Username"}'
; E621_API_KEY='{ ... }'
; E926_API_KEY='{ ... }'
; HYPNOHUB_API_KEY='{ ... }'
; KONACHAN_API_KEY='{ ... }'
; YANDERE_API_KEY='{ ... }'
; SAFEBOORU_API_KEY='{ ... }'
; TBIB_API_KEY='{ ... }'
; XBOORU_API_KEY='{ ... }'
; RULE34PAHEAL_API_KEY='{ ... }'
; DERPIBOORU_API_KEY='{ ... }'
; REALBOORU_API_KEY='{ ... }'
```

### Pre-built Docker image

A pre-built image is available from [GitHub](https://github.com/AtoraSuunva/BooruBot/pkgs/container/boorubot), currently building off the latest main commit.

Create a `docker-boorubot.yml` (or whatever name you want):

```yml
services:
  bot:
    image: 'ghcr.io/atorasuunva/boorubot:main'
    restart: always
    init: true
    env_file:
      - .env
    volumes:
      - boorubot-db:/home/node/app/prisma/db
    healthcheck:
      test: [ "CMD-SHELL", "wget --no-verbose --tries=1 -O- http://bot:${HEALTHCHECK_PORT}/healthcheck || exit 1" ]
      interval: 10s
      timeout: 30s
      retries: 5
      start_period: 5s

volumes:
  boorubot-db:
```

Then run it via `docker compose -f docker-boorubot.yml`. This avoids needing to clone the repo and wait for builds. A `docker run` will work as well, but require copy-pasting the command to keep the config.

> Currently, the activities file `activities-booru.txt` is baked into the image. You can't change the activities without needing to rebuild the image. Someday I'll change it, but it's pretty low priority.

### Docker

If you prefer/need to re-build the image (ie. you've changed the code), you can use the provided `docker-compose.yml` and `docker compose up -d --build` to handle it all for you.

### Installing dependencies yourself

You'll need Node.js (I think at least v18, but I only test using v20), pnpm, patience, and prayers.

Assuming you have Node.js and pnpm installed and working:

```sh
# Install dependencies (*should* generate prisma client)
pnpm install

# Either
pnpm build
pnpm start:prod
# Or, doing both steps in 1 command
pnpm start:dev
```

---

### License

It's MIT, so you can fork the bot, host your own private copy, etc. You just need to keep a copy of the license and copyright notice around.
