// deno-lint-ignore-file no-console
/**
 * Command-line interface for the `lonely-planet` client.
 *
 * @module cli
 */

import { Command, ValidationError } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { version } from "@roka/forge/version";
import {
  type Attraction,
  type Destination,
  lonelyPlanet,
} from "./lonely-planet.ts";

/**
 * Run the `lonely-planet` tool with the given command-line arguments.
 *
 * @param args Command-line arguments.
 * @returns The exit code of the command.
 */
export async function cli(args: string[]): Promise<number> {
  const EMOJIS = {
    Continent: "🌍",
    Country: "🏳️",
    Region: "🏞️",
    City: "🏙️",
    Neighborhood: "🏘️",
    Attractions: "🎡",
    Feature: "📰",
    News: "📢",
  };
  const cmd = new Command()
    .name("lonely-planet")
    .description("Explores data from Lonely Planet.")
    .version(await version({ release: true, target: true }))
    .example("lonely-planet big sur", "Search destinations for 'big sur'.")
    .example("lonely-planet --attractions amsterdam", "Search attractions.")
    .example("lonely-planet --stories amsterdam", "Search stories.")
    .example("lonely-planet --destinations --attractions --stories", "All.")
    .example("lonely-planet --json | jq", "Stream destinations as json.")
    .arguments("[keywords...:string]")
    .option("--destinations", "Include destinations in the results.")
    .option("--attractions", "Include attractions in the results.")
    .option("--stories", "Include stories in the results.")
    .option("--json", "Output the search results as concatenated JSON.")
    .action(
      async (options, ...keywords) => {
        if (!options.destinations && !options.attractions && !options.stories) {
          options.destinations = true;
        }
        const client = lonelyPlanet();
        function breadcrumb(document: Destination | Attraction) {
          return `[ ${document.breadcrumb.map((x) => x.title).join(" > ")} ]`;
        }
        const rows: string[][] = [];
        if (options.destinations) {
          for await (const doc of client.destinations(keywords)) {
            if (options.json) console.log(JSON.stringify(doc));
            else rows.push([EMOJIS[doc.type], doc.title, breadcrumb(doc)]);
          }
        }
        if (options.attractions) {
          for await (const doc of client.attractions(keywords)) {
            if (options.json) console.log(JSON.stringify(doc));
            else rows.push([EMOJIS[doc.type], doc.title, breadcrumb(doc)]);
          }
        }
        if (options.stories) {
          for await (const doc of client.stories(keywords)) {
            if (options.json) console.log(JSON.stringify(doc));
            else rows.push([EMOJIS[doc.type], doc.title]);
          }
        }
        Table.from(rows).render();
      },
    );

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

if (import.meta.main) Deno.exit(await cli(Deno.args));
