# duolingo ([jsr.io](https://jsr.io/@tugrulates/duolingo))

Interactions with Duolingo, the language learning platform.

## CLI

Run `duolingo` after installation, or run `deno run -A @tugrulates/duolingo`
without installation.

### Examples

| Command                                                        | Description                                        |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `duolingo --username <username> --token <token>`               | Configure.                                         |
| `duolingo --clear`                                             | Clear the cached configuration.                    |
| `duolingo feed`                                                | Prints the feed.                                   |
| `duolingo feed --engage`                                       | Engages with the feed.                             |
| `duolingo feed --json \| jq`                                   | Query JSON over the feed.                          |
| `duolingo follows`                                             | Prints follow counts.                              |
| `duolingo follows --follows`                                   | Follow users who follow.                           |
| `duolingo follows --unfollow`                                  | Unfollow users who dont' follow.                   |
| `duolingo follows --follow --unfollow`                         | Matches both lists.                                |
| `duolingo follows --json`                                      | Outputs JSON of follower information.              |
| `duolingo follows --json \| jq`                                | Query JSON for follower information.               |
| `duolingo follows --json \| jq '.dontFollowBack[].username'`   | List users who are followed but don't follow back. |
| `duolingo follows --json \| jq '.notFollowingBack[].username'` | List users who follow but are not followed back.   |
| `duolingo league`                                              | Prints the league.                                 |
| `duolingo league --follow`                                     | Follows users in the league.                       |
| `duolingo league --json \| jq`                                 | Query JSON over the league.                        |

## Classes

### [DuolingoClient](https://jsr.io/@tugrulates/duolingo/doc/~/DuolingoClient)

A client for interacting with the Duolingo API.

Requires the JWT (JSON web token) for the logged-in user.

## Types

### [FeedCard](https://jsr.io/@tugrulates/duolingo/doc/~/FeedCard)

A Duolingo feed card, like a milestone or league promotion.

### [Friend](https://jsr.io/@tugrulates/duolingo/doc/~/Friend)

A user other than the current user on Duolingo.

### [League](https://jsr.io/@tugrulates/duolingo/doc/~/League)

A Duolingo league and its user rankings.

### [LeagueUser](https://jsr.io/@tugrulates/duolingo/doc/~/LeagueUser)

A user in a Duolingo league.

## Functions

### [engageWithCard](https://jsr.io/@tugrulates/duolingo/doc/~/engageWithCard)

Engages with the event, following the user or sending a reaction.

### [followLeagueUsers](https://jsr.io/@tugrulates/duolingo/doc/~/followLeagueUsers)

Follows all the users in the league.

### [getEmoji](https://jsr.io/@tugrulates/duolingo/doc/~/getEmoji)

Returns the display emoji for the card.

### [getLeagueUserEmoji](https://jsr.io/@tugrulates/duolingo/doc/~/getLeagueUserEmoji)

Returns the emoji for the user's reaction.

### [getReaction](https://jsr.io/@tugrulates/duolingo/doc/~/getReaction)

Returns the reaction on the card, or picks an appripriate one.

## Constants

### [LANGUAGES](https://jsr.io/@tugrulates/duolingo/doc/~/LANGUAGES)

Language codes on Duolingo, with their names, and flags.

This only lists target languages, and not source languages.

### [LEAGUES](https://jsr.io/@tugrulates/duolingo/doc/~/LEAGUES)

Duolingo leagues tiers, their names, and emojis.

### [REACTIONS](https://jsr.io/@tugrulates/duolingo/doc/~/REACTIONS)

Reactions to Duolingo feed events and the corresponding emojis.
