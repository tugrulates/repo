/**
 * Command-line interface for the `duolingo` client.
 *
 * @module cli
 */

import { Command } from "@cliffy/command";
import { Input, Secret } from "@cliffy/prompt";
import { Table } from "@cliffy/table";
import { pool } from "@roka/async/pool";
import { type Config, config } from "@roka/cli/config";
import { console } from "@roka/cli/console";
import { version } from "@roka/forge/version";
import { plain } from "@roka/html/plain";
import { maybe } from "@roka/maybe";
import { distinctBy, pick } from "@std/collections";
import { red } from "@std/fmt/colors";
import type { Duolingo, FeedCard } from "./duolingo.ts";
import { duolingo, LEAGUES } from "./duolingo.ts";
import { leagueEmoji, leagueUserEmoji } from "./emoji.ts";

const ERROR = red("✘");

/** Options for the {@link cli} function. */
export type CliOptions = {
  /** Duolingo username. */
  username?: string;
  /** Duolingo JWT token. */
  token?: string;
  /** Caching strategy for API requests. */
  cache?: RequestCache;
};

/**
 * Runs the `duolingo` tool.
 *
 * @param options Uses given config instead of the default user config
 */
export async function cli(options?: CliOptions): Promise<number> {
  const cfg = config<CliOptions>(options ? { path: ":memory:" } : {});
  if (options) await cfg.set(options);
  const { username, token } = await cfg.get();
  const cmd = new Command()
    .name("duolingo")
    .description("Interact with Duolingo.")
    .usage("--username <username> --token <token> <command> [options]")
    .version(await version({ target: true }))
    .example("duolingo --username <username> --token <token>", "Configure.")
    .example("duolingo --clear", "Clear the cached configuration.")
    .option(
      "--clear",
      "Clear the cached configuration.",
      { standalone: true, action: () => cfg.clear() },
    )
    .globalEnv(
      "DUOLINGO_USERNAME=<username:string>",
      "Username.",
      { prefix: "DUOLINGO_" },
    )
    .globalOption(
      "--username <username:string>",
      "Username.",
      username ? { default: username } : {},
    )
    .globalEnv(
      "DUOLINGO_TOKEN=<token:secret>",
      "JWT token.",
      { prefix: "DUOLINGO_" },
    )
    .globalOption(
      "--token <token:secret>",
      "JWT token.",
      token ? { default: token } : {},
    )
    .globalOption(
      "--verbose",
      "Print additional information.",
      { hidden: true, action: () => console.verbose = true },
    )
    .help({ colors: Deno.stdout.isTerminal() })
    .globalAction((options) => cfg.set(pick(options, ["username", "token"])))
    .command("feed", feedCommand(cfg))
    .command("follows", followsCommand(cfg))
    .command("league", leagueCommand(cfg));
  const { errors } = await maybe(() => cmd.parse());
  for (const error of errors ?? []) {
    console.error(ERROR, red(error.message));
    console.debug(error);
  }
  return errors ? 1 : 0;
}

function feedCommand(cfg: Config<CliOptions>) {
  function summary(card: FeedCard): string {
    const name = card.header ? plain(card.header) : card.displayName;
    const body = plain(card.body).trimEnd();
    if (!name || body.startsWith(name)) return body;
    return `${name} ${body.toLowerCase()}`;
  }
  return new Command()
    .description("Prints and interacts with the feed.")
    .example("duolingo feed", "Prints the feed.")
    .example("duolingo feed --engage", "Engages with the feed.")
    .example("duolingo feed --json | jq", "Query JSON over the feed.")
    .option("--engage", "Engage with the feed events.")
    .option("--follow", "Re-follow followers.")
    .option("--json", "Output the feed as JSON.")
    .action(async ({ engage, json }) => {
      const client = await api(cfg);
      const me = await client.users.me();
      const cards = await client.feed.get();
      async function react(card: FeedCard): Promise<boolean> {
        if (card.cardType === "FOLLOW") {
          const user = await client.users.get(card.userId);
          if (user && !user.isFollowing && user.canFollow) {
            const ok = await client.users.follow(card.userId);
            if (ok) console.log(`✅ Followed ${card.displayName}.`);
            return true;
          }
        } else if (
          card.cardType === "KUDOS_OFFER" ||
          card.cardType === "SHARE_SENTENCE_OFFER"
        ) {
          if (engage && !card.reactionType && card.userId !== me.id) {
            await client.feed.react(card);
            return true;
          }
        }
        return false;
      }
      if (json) console.log(JSON.stringify(cards, undefined, 2));
      await pool(
        cards,
        async (card) => {
          if (engage) await react(card);
          if (!json) {
            console.log(
              card.reactionType || engage ? "💚" : "  ",
              summary(card),
            );
          }
        },
        { concurrency: 1 },
      );
    });
}

function followsCommand(config: Config<CliOptions>) {
  return new Command()
    .description("Prints and manages follower information on Duolingo.")
    .example("duolingo follows", "Prints follow counts.")
    .example("duolingo follows --follow", "Follow active users who follow.")
    .example(
      "duolingo follows --unfollow",
      "Unfollow inactive or non-following users.",
    )
    .example("duolingo follows --follow --unfollow", "Matches both lists.")
    .example("duolingo follows --json", "Outputs JSON of follower information.")
    .example(
      "duolingo follows --json | jq",
      "Query JSON for follower information.",
    )
    .example(
      "duolingo follows --json | jq '.dontFollowBack[].username'",
      "List users who are followed but don't follow back.",
    )
    .example(
      "duolingo follows --json | jq '.notFollowingBack[].username'",
      "List users who follow but are not followed back.",
    )
    .option("--follow", "Follow users who follow.", { default: false })
    .option("--unfollow", "Unfollow users who don't follow.", {
      default: false,
    })
    .option("--json", "Output the follower information as JSON.")
    .action(async ({ follow, unfollow, json }) => {
      const client = await api(config);
      let result = await client.follows.get();
      if (json) console.log(JSON.stringify(result, undefined, 2));
      else {
        console.log(`👤 Following ${result.following.length} people.`);
        console.log(`👤 Followed by ${result.followers.length} people.`);
      }
      if (follow || unfollow) {
        if (follow) {
          const active = (await pool(
            result.notFollowingBack.filter((friend) => friend.canFollow),
            async (friend) => {
              const user = await client.users.get(friend.userId);
              return { ...friend, streak: user.streak };
            },
            { concurrency: 8 },
          )).filter((friend) => friend.streak > 0);
          await pool(
            active,
            async (friend) => {
              const ok = await client.users.follow(friend.userId);
              if (!json && ok) {
                console.log(`✅ Followed ${friend.displayName}.`);
              }
            },
            { concurrency: 1 },
          );
        }
        if (unfollow) {
          const inactive = (await pool(result.following, async (friend) => {
            const { streak } = await client.users.get(friend.userId);
            return { ...friend, streak };
          }, { concurrency: 8 }))
            .filter((friend) => friend.streak === 0);
          await pool(
            distinctBy(
              result.dontFollowBack.concat(inactive),
              (friend) => friend.userId,
            ),
            async (friend) => {
              const ok = await client.users.unfollow(friend.userId);
              if (!json && ok) {
                console.log(`❌ Unfollowed ${friend.displayName}.`);
              }
            },
            { concurrency: 1 },
          );
        }
        result = await client.follows.get();
      }
    });
}

function leagueCommand(config: Config<CliOptions>) {
  return new Command()
    .description("Prints and interacts with the current Duolingo league.")
    .example("duolingo league", "Prints the league.")
    .example("duolingo league --follow", "Follows users in the league.")
    .example("duolingo league --json | jq", "Query JSON over the league.")
    .option("--follow", "Follow users in the league.")
    .option("--json", "Output the league as JSON.")
    .action(async ({ follow, json }) => {
      const client = await api(config);
      const league = await client.league.get();
      if (league) {
        const users = await Promise.all(
          league.rankings.map((user) => client.users.get(user.user_id)),
        );
        if (follow) {
          await pool(
            users.filter((user) => user.canFollow && !user.isFollowing),
            async (user) => {
              const ok = await client.users.follow(user.id);
              if (!json && ok) console.log(`✅ Followed ${user.name}.`);
            },
            { concurrency: 1 },
          );
        }
        if (json) console.log(JSON.stringify(league, undefined, 2));
        else {
          new Table()
            .header([leagueEmoji(league), LEAGUES[league.tier]])
            .body(
              league.rankings.map((user, index) => [
                `${index + 1}.`,
                `${user.display_name} ${leagueUserEmoji(user)}`,
                users.find((u) =>
                    u.id === user.user_id && u.isFollowing && u.isFollowedBy
                  )
                  ? "👤"
                  : "",
                `${user.score.toString()} XP`,
              ]),
            )
            .columns([{ align: "right" }, {}, {}, { align: "right" }])
            .render();
        }
      } else {
        if (json) console.log("{}");
        else console.log("🏆 The league has not started yet.");
      }
    });
}

async function api(cfg: Config<CliOptions>): Promise<Duolingo> {
  let { username, token, cache } = await cfg.get();
  if (!username) username = await Input.prompt("Username");
  if (!token) token = await Secret.prompt("Token");
  if (!username || !token) throw new Error("Username and token are required.");
  return duolingo({ username, token, ...cache && { cache } });
}

if (import.meta.main) Deno.exit(await cli());
