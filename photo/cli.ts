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

import { Command, ValidationError } from "@cliffy/command";
import { pooled } from "@roka/async/pool";
import { version } from "@roka/forge/version";
import { yellow } from "@std/fmt/colors";
import { join } from "@std/path";
import { check, type Photo, photo, sync } from "./photo.ts";

/**
 * Run the `photos` tool with the given command-line arguments.
 *
 * @param args Command-line arguments.
 * @returns The exit code of the command.
 */
export async function photos(args: string[]): Promise<number> {
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
      async function* inputs(paths: string[]): AsyncGenerator<Photo> {
        function photos(paths: string[]) {
          return pooled(paths, async (path) => {
            try {
              return await photo(path);
            } catch (e: unknown) {
              if (!(e instanceof Deno.errors.NotFound)) throw e;
              return path;
            }
          });
        }
        for await (const input of photos(paths)) {
          if (typeof input !== "string") yield input;
          if (typeof input !== "string") continue;
          const paths = (await Array.fromAsync(Deno.readDir(input)))
            .filter((path) => path.isDirectory)
            .map((path) => join(input, path.name))
            .toSorted();
          for await (const input of photos(paths)) {
            if (typeof input !== "string") yield input;
          }
        }
      }
      if (!photos.length) photos.push(".");
      for await (const photo of inputs(photos)) {
        if (options.sync) await sync(photo);
        if (options.json) console.log(JSON.stringify(photo, null, 2));
        else {
          const warnings = check(photo);
          const title = `🖼  ${photo.title}`;
          if (warnings.length) {
            console.log(`${title} [${yellow(warnings.join(" "))}]`);
          } else console.log(title);
        }
      }
    });
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

if (import.meta.main) Deno.exit(await photos(Deno.args));
