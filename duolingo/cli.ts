// deno-lint-ignore-file no-console
/**
 * Command-line interface for the `duolingo` client.
 *
 * @module cli
 */

import { Command, ValidationError } from "@cliffy/command";
import { Input, Secret } from "@cliffy/prompt";
import { Table } from "@cliffy/table";
import { pool } from "@roka/async/pool";
import { type Config, config } from "@roka/cli/config";
import { version } from "@roka/forge/version";
import { escape } from "@std/html";
import type { Duolingo, FeedCard } from "./duolingo.ts";
import { duolingo, TIERS } from "./duolingo.ts";
import { leagueEmoji, leagueUserEmoji, reactionEmoji } from "./emoji.ts";

type DuolingoConfig = { username: string; token: string };

/**
 * Run the `duolingo` tool with the given command-line arguments.
 *
 * @param args Command-line arguments.
 * @returns The exit code of the command.
 */
export async function cli(args: string[]): Promise<number> {
  const cfg = config<DuolingoConfig>();
  const { username, token } = await cfg.get();
  const cmd = new Command()
    .name("duolingo")
    .description("Interact with Duolingo.")
    .usage("--username <username> --token <token> <command> [options]")
    .version(await version({ target: true }))
    .example("duolingo --username <username> --token <token>", "Configure.")
    .example("duolingo --clear", "Clear the cached configuration.")
    .option("--clear", "Clear the cached configuration.", {
      standalone: true,
      action: () => cfg.clear(),
    })
    .globalEnv("DUOLINGO_USERNAME=<username:string>", "Username.", {
      prefix: "DUOLINGO_",
    })
    .globalOption(
      "--username <username:string>",
      "Username.",
      username ? { default: username } : {},
    )
    .globalEnv("DUOLINGO_TOKEN=<token:string>", "JWT token.", {
      prefix: "DUOLINGO_",
    })
    .globalOption(
      "--token <token:string>",
      "JWT token.",
      token ? { default: token } : {},
    )
    .help({ colors: Deno.stdout.isTerminal() })
    .noExit()
    .globalAction((options) => cfg.set(options))
    .command("feed", feedCommand(cfg))
    .command("follows", followsCommand(cfg))
    .command("league", leagueCommand(cfg));
  try {
    await cmd.parse(args);
  } catch (e: unknown) {
    if (e instanceof ValidationError) {
      cmd.showHelp();
      console.error(`❌ ${e.message}`);
      return 1;
    }
    const errors = (e instanceof AggregateError) ? e.errors : [e];
    for (const error of errors) {
      console.error(`❌ ${error.message}`);
      if (error["cause"] && error["cause"]["error"]) {
        console.error(error.cause.error);
      }
    }
    return 2;
  }
  return 0;
}

function feedCommand(cfg: Config<DuolingoConfig>) {
  function summary(card: FeedCard): string {
    function plain(html: string) {
      return escape(html)
        .replace(/&lt;.*?&gt;/g, "")
        .replace(/[\u200E-\u200F]/g, "");
    }
    return card.header
      ? plain(card.header)
      : `${card.displayName} ${plain(card.body).toLowerCase()}`;
  }
  return new Command()
    .description("Prints and interacts with the feed.")
    .example("duolingo feed", "Prints the feed.")
    .example("duolingo feed --engage", "Engages with the feed.")
    .example("duolingo feed --json | jq", "Query JSON over the feed.")
    .option("--engage", "Engage with the feed events.")
    .option("--json", "Output the feed as JSON.")
    .action(async ({ engage, json }) => {
      const client = await api(cfg);
      const followers = await client.follows.followers();
      const cards = await client.feed.get();
      async function react(card: FeedCard): Promise<boolean> {
        if (card.cardType === "FOLLOW") {
          const user = followers.find((user) => user.userId === card.userId);
          if (!user?.isFollowing && !user?.canFollow) {
            await client.users.follow(card.userId);
            return true;
          }
        } else if (
          card.cardType === "KUDOS_OFFER" ||
          card.cardType === "SHARE_SENTENCE_OFFER"
        ) {
          if (!card.reactionType) {
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
          if (!engage || await react(card)) {
            if (!json) console.log(`${reactionEmoji(card)} ${summary(card)}`);
          }
        },
        { concurrency: 1 },
      );
    });
}

function followsCommand(config: Config<DuolingoConfig>) {
  return new Command()
    .description("Prints and manages follower information on Duolingo.")
    .example("duolingo follows", "Prints follow counts.")
    .example("duolingo follows --follows", "Follow users who follow.")
    .example("duolingo follows --unfollow", "Unfollow users who dont' follow.")
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
    .option("--follow", "Follow users who follow.")
    .option("--unfollow", "Unfollow users who don't follow.")
    .option("--json", "Output the follower information as JSON.")
    .action(async ({ follow, unfollow, json }) => {
      const client = await api(config);
      let result = await client.follows.get();

      if (follow || unfollow) {
        if (follow) {
          await pool(
            result.notFollowingBack,
            async (user) => {
              if (user.canFollow) {
                const ok = await client.users.follow(user);
                if (!json && ok) console.log(`✅ Followed ${user.username}.`);
              }
            },
            { concurrency: 1 },
          );
        }
        if (unfollow) {
          await pool(
            result.dontFollowBack,
            async (user) => {
              const ok = await client.users.unfollow(user);
              if (!json && ok) console.log(`❌ Unfollowed ${user.username}.`);
            },
            { concurrency: 1 },
          );
        }
        result = await client.follows.get();
      }

      if (json) console.log(JSON.stringify(result, undefined, 2));
      else {
        console.log(`👤 Following ${result.following.length} people.`);
        console.log(`👤 Followed by ${result.followers.length} people.`);
      }
    });
}

function leagueCommand(config: Config<DuolingoConfig>) {
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
        if (follow) await client.league.follow(league);
        if (json) console.log(JSON.stringify(league, undefined, 2));
        else {
          const following = await client.follows.following();
          new Table()
            .header([leagueEmoji(league), `${TIERS[league.tier]} League`])
            .body(
              league.rankings.map((user, index) => [
                `${index + 1}.`,
                `${user.display_name} ${leagueUserEmoji(user)}`,
                following.find((f) => f.userId === user.user_id) ? "👤" : "",
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

async function api(cfg: Config<DuolingoConfig>): Promise<Duolingo> {
  let { username, token } = await cfg.get();
  if (!username) username = await Input.prompt("Username");
  if (!token) token = await Secret.prompt("Token");
  if (!username || !token) throw new Error("Username and token are required.");
  return duolingo({ username, token });
}

if (import.meta.main) Deno.exit(await cli(Deno.args));
