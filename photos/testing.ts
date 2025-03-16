/**
 * This module provides test photos to test the `photos` package.
 *
 * @module testing
 */

import { pool } from "@roka/async/pool";
import { assertExists } from "@std/assert";
import { copy } from "@std/fs";
import { join } from "@std/path";
import { write, type WriteOptions } from "@tugrulates/photos/exif";
import { type Photo, photo } from "@tugrulates/photos/photo";

/**
 * Creates a temporary photo.
 *
 * @param options Update photo with given tags.
 * @returns A disposable photo with variants.
 */
export async function tempPhoto(
  options?: WriteOptions,
): Promise<Photo & AsyncDisposable> {
  const directory = await Deno.makeTempDir();
  assertExists(import.meta.dirname);
  await copy(
    join(import.meta.dirname, "__testdata__", "floating-around"),
    directory,
    { overwrite: true },
  );
  let result = await photo(directory);
  if (options) {
    await write(result.path, options);
    await pool(result.variants, (variant) => write(variant.path, options));
    result = await photo(directory);
  }
  return Object.assign(await photo(directory), {
    [Symbol.asyncDispose]: () => Deno.remove(directory, { recursive: true }),
  });
}
