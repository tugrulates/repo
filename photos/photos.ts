// deno-lint-ignore-file no-console
/**
 * A tool for photography editing and publishing workflows.
 *
 * The binary for `exiftool` is bundled with this library. However, the
 * compiled binary `photos` requires `exiftool` to be present in the system.
 * For macOS, it can be installed using Homebrew with `brew install exiftool`.
 * For other systems, see the [official website](https://exiftool.org/).
 *
 * @module photos
 */

import { Command } from "@cliffy/command";
import { pool, pooled } from "@roka/async/pool";
import { version } from "@roka/forge/version";
import { yellow } from "@std/fmt/colors";
import { expandGlob } from "@std/fs";
import { join } from "@std/path";
import { check, type Photo, photo, sync } from "./photo.ts";

const SOURCE_FILE = "source.jpg";

export async function photos(args: string[]): Promise<number> {
  await new Command()
    .name("photos")
    .description("Manage photos.")
    .version(await version({ release: true, target: true }))
    .example("photos", "Lists all photos under current directory.")
    .example("photos [photo] --json", "Data for a photo with all variants.")
    .example("photos [photo] --copy", "Copy EXIF data to all variants.")
    .arguments("[photos...:file]")
    .option("--copy", "Copy the EXIF from source JPG to other variants.")
    .option("--json", "Output the EXIF information as JSON.")
    .action(async ({ copy, json }, ...photos) => {
      if (copy) await pool(inputs(photos), sync);
      for await (const photo of pooled(inputs(photos))) {
        console.log(json ? JSON.stringify(photo, null, 2) : display(photo));
      }
    })
    .parse(args);
  return 0;
}

function display(photo: Photo) {
  const warnings = check(photo);
  const title = `🖼  ${photo.title}`;
  if (warnings.length) return `${title} [${yellow(warnings.join(" "))}]`;
  else return title;
}

async function* inputs(srcs: string[]): AsyncGenerator<Photo> {
  if (srcs.length === 0) {
    for await (const entry of expandGlob(join("*", SOURCE_FILE))) {
      yield await photo(entry.path);
    }
  }
  async function isFile(path: string): Promise<boolean> {
    try {
      const info = await Deno.lstat(path);
      return info.isFile;
    } catch {
      return false;
    }
  }
  async function path(src: string) {
    return await isFile(src) ? src : join(src, SOURCE_FILE);
  }
  for await (const src of pooled(srcs, path)) yield await photo(src);
}

if (import.meta.main) Deno.exit(await photos(Deno.args));
