import { pool } from "@roka/async/pool";
import { filterKeys, omit } from "@std/collections";
import { basename, dirname, join } from "@std/path";
import { copy, type Exif, exif } from "./exif.ts";

/** A photo returned from the {@linkcode photo} function. */
export interface Photo extends Exif {
  /** Exchangable id of the photo. */
  id: string;
  /** Source file path for this photo. */
  path: string;
  /** Different variants of this photo, with only the differences. */
  variants: (Exif & { path: string })[];
}

/**
 * Returns the data for a photo using a single file.
 *
 * @param path Source photo to get information for.
 * @returns Data for the photo or file.
 */
export async function photo(path: string): Promise<Photo> {
  const directory = dirname(path);
  const files = (await Array.fromAsync(Deno.readDir(directory)))
    .filter((f) => f.isFile)
    .filter((f) => f.name.endsWith(".jpg"))
    .map((f) => join(directory, f.name))
    .toSorted();
  const sizes = await pool(
    files,
    async (path) => ({ path, ...await exif(path) }),
  );
  const source = sizes.find((e) => e.path === path);
  if (!source) throw new Error(`Source file not found in ${path}`);
  const variants = sizes.filter((e) => e.path !== path);
  return {
    ...source,
    id: basename(dirname(path)),
    variants: variants
      .map((variant) => ({
        ...filterKeys(
          variant,
          (key) =>
            JSON.stringify(variant[key as keyof typeof variant]) !==
              JSON.stringify(source[key as keyof typeof variant]),
        ),
        path: variant.path,
        width: variant.width,
        height: variant.height,
      })),
  };
}
/** Copies the EXIF data from photo source to its variants. */
export async function sync(photo: Photo) {
  await pool(photo.variants, async (variant) => {
    const tags = await exif(photo.path);
    const groupMatch = /.*-(\d+).jpg/.exec(variant.path);
    const description = groupMatch && tags.description?.replace(
      /^(.*?)(\.?)$/,
      `$1 (image ${groupMatch[1]}).`,
    );
    await copy(photo.path, variant.path, description ? { description } : {});
  });
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
    if (!(field in photo)) warnings.push(`missing:${field}`);
  }
  for (const variant of photo.variants) {
    for (
      const field in omit(variant, ["path", "width", "height", "description"])
    ) {
      if (field in variant) warnings.push(`${basename(variant.path)}:${field}`);
    }
  }
  return warnings;
}
