## blacklist

- autocomplete for blacklist remove?
  - hard maybe on tags, since autocomplete stops the input
  - would work well for sites, since most people probably just remove 1 at a time
  - autocomplete for `all`/`nsfw`/`sfw` options?

## search

- show # of hidden posts because of blacklist?
- let others interact with buttons -> open new ephemeral message?
  - have to open it, pain the ass...
- "Post publically" should show poster
- "Post publically" should be disabled right after using it
- make sure `rating:s` etc are supported
- random!!
- make sure to avoid posting non-`s` posts in sfw channels
- check search tags for blacklisted tags and bail early
- check site for blacklisted sites as well 
- error handling on booru
- disable `random: true` on order tags:
  - `const orderTags = ['order:', 'sort:']`
- check blacklisted types `type:<ext>`
- check blacklisted ratings `rating:`
- do blacklisted checks somewhere specific? another file?
