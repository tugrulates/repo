/**
 * A library for photography editing and publishing workflows.
 *
 * The main module provides access to photo collections, which are different
 * size and crops of the same photograph via the {@linkcode photo} function.
 * The main photo in a directory is always named `source.jpg`, and the
 * variants are found next to the source photo.
 *
 * ```ts
 * import { photo } from "@tugrulates/photo";
 *
 * async function usage() {
 *   const photo = await photo("path/to/photo");
 *   console.log(photo.title);
 *   console.log(photo.variants);
 * }
 * ```
 *
 * The {@link [cli]} module provides a command-line interface for this library.
 *
 * ```sh
 * deno run --A jsr:@tugrulates/photo/cli path/to/photo --json
 * ```
 *
 * The binary for `exiftool` is bundled. However, the binary compiled with
 * {@link https://jsr.io/@roka/forge | forge} needs `exiftool` installation.
 * For macOS, it can be installed using Homebrew with `brew install exiftool`.
 * For other systems, see the [official website](https://exiftool.org/).
 *
 * @todo Deduce source file name automatically from dimensions.
 *
 * @module photo
 */

import { pool } from "@roka/async/pool";
import { omit } from "@std/collections";
import { basename, dirname, join } from "@std/path";
import { type Exif, exif, write } from "./exif.ts";

/** A photo returned from the {@linkcode photo} function. */
export interface Photo extends Image {
  /** Exchangable id of the photo. */
  id: string;
  /** Different variants of this photo. */
  variants: Image[];
}

/** A single image file. */
export interface Image extends Exif {
  /** File path for this image. */
  path: string;
}

/**
 * Returns a photo from a photo directory or image file path.
 *
 * @param path Source photo to get information for.
 * @returns Data for the photo or file.
 */
export async function photo(path: string): Promise<Photo> {
  let directory: string;
  if ((await Deno.stat(path)).isDirectory) {
    directory = path;
    path = join(directory, "source.jpg");
  } else {
    directory = dirname(path);
  }
  const files = (await Array.fromAsync(Deno.readDir(directory)))
    .filter((f) => f.isFile)
    .filter((f) => f.name.endsWith(".jpg"))
    .map((f) => join(directory, f.name))
    .toSorted();
  const sizes: Image[] = await pool(
    files,
    async (path) => ({ path, ...await exif(path) }),
  );
  const source = sizes.find((e) => e.path === path);
  if (!source) {
    throw new Deno.errors.NotFound(`Source file not found in ${path}`);
  }
  const variants = sizes.filter((e) => e.path !== path);
  return { ...source, id: basename(dirname(path)), variants };
}

/**
 * Checks the photo for problems.
 *
 * Photo missing required fields, and the variants having different field
 * values than the source photo are considered problems.
 *
 * @returns A list of warnings, one for each problem.
 */
export function check(photo: Photo): string[] {
  const warnings: string[] = [];
  for (const field in omit(photo, ["city"])) {
    const value = photo[field as keyof Image];
    if (!value || (Array.isArray(value) && !value.length)) {
      warnings.push(`missing:${field}`);
    }
  }
  for (const variant of photo.variants) {
    for (
      const field in omit(variant, ["path", "width", "height", "description"])
    ) {
      if (
        JSON.stringify(variant[field as keyof Image]) !==
          JSON.stringify(photo[field as keyof Image])
      ) {
        warnings.push(`${basename(variant.path)}:${field}`);
      }
    }
  }
  return warnings;
}

/** Copies tags from photo source to its variants. */
export async function sync(photo: Photo) {
  photo.variants = await pool(photo.variants, async (variant) => {
    const tags = await exif(photo.path);
    const groupMatch = /.*-(\d+).jpg/.exec(variant.path);
    const description = groupMatch && tags.description?.replace(
      /^(.*?)(\.?)$/,
      `$1 (image ${groupMatch[1]}).`,
    );
    await write(variant.path, {
      source: photo.path,
      ...description ? { description } : {},
    });
    return {
      path: variant.path,
      ...await exif(variant.path),
    };
  });
}
