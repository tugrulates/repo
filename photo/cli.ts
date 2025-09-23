// deno-lint-ignore-file no-console
/**
 * Command-line interface for the `photo` library.
 *
 * The binary for `exiftool` is bundled. However, the binary compiled with
 * {@link https://jsr.io/@roka/forge | forge} needs `exiftool` installation.
 * For macOS, it can be installed using Homebrew with `brew install exiftool`.
 * For other systems, see the [official website](https://exiftool.org/).
 *
 * @module cli
 */

import { Command } from "@cliffy/command";
import { pooled } from "@roka/async/pool";
import { version } from "@roka/forge/version";
import { find } from "@roka/fs/find";
import { maybe } from "@roka/maybe";
import { distinct } from "@std/collections";
import { yellow } from "@std/fmt/colors";
import { dirname } from "node:path";
import { check, photo, sync } from "./photo.ts";

/** Run the `photos` tool. */
export async function cli(): Promise<number> {
  const cmd = new Command()
    .name("photos")
    .description("Manage photos.")
    .version(await version({ release: true, target: true }))
    .example("photos", "Lists all photos under current directory.")
    .example("photos [photo] --json", "Data of a photo with all variants.")
    .example("photos [photo] --sync", "Copy tags to all variants.")
    .arguments("[photos...:file]")
    .option("--sync", "Sync tags from source file to other variants.")
    .option("--json", "Output photo information as JSON.")
    .action(async (options, ...photos) => {
      const images = await Array.fromAsync(
        find([...photos], { name: "*.{jpg,jpeg}" }),
      );
      const dirs = distinct(images.map(dirname)).sort();
      for await (const p of pooled(dirs, (dir) => photo(dir))) {
        if (options.sync) await sync(p);
        if (options.json) console.log(JSON.stringify(p, null, 2));
        else {
          const warnings = check(p);
          const title = `🖼  ${p.title}`;
          if (warnings.length) {
            console.log(`${title} [${yellow(warnings.join(" "))}]`);
          } else console.log(title);
        }
      }
    });
  const { errors } = await maybe(() => cmd.parse());
  for (const error of errors ?? []) {
    console.error(`❌ ${error}`);
  }
  return errors ? 1 : 0;
}

if (import.meta.main) Deno.exit(await cli());
