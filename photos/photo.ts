import { pool } from "@roka/async/pool";
import { filterKeys, omit } from "@std/collections";
import { basename, dirname, join } from "@std/path";
import { copy, type Exif, exif } from "./exif.ts";

/**
 * Represents a photo with additional metadata and sizes.
 *
 * @extends Exif with all fields except resolution, which are listed on individial
 * file sizes instead.
 */
export interface Photo extends Exif {
  /** Exchangable id of the photo. */
  id: string;
  /** Different variants of this photo, with only the differences. */
  variants: Exif[];
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
  const tags = await pool(files, exif);
  const photo = tags.find((e) => e.src === path);
  if (!photo) throw new Error(`EXIF cannot be extracted for ${path}`);
  return {
    id: basename(dirname(path)),
    ...photo,
    variants: tags.filter((e) => e.src !== path).map((data) => ({
      ...filterKeys(
        data,
        (k) => JSON.stringify(photo[k]) !== JSON.stringify(data[k]),
      ),
      src: data.src,
      width: data.width,
      height: data.height,
    })),
  };
}
/**
 * Copies the EXIF data from photo source to its variants.
 *
 * @param photo Photo data for managing EXIF.
 */
export async function sync(photo: Photo) {
  await pool(photo.variants, async (variant) => {
    const tags = await exif(photo.src);
    const groupMatch = /.*-(\d+).jpg/.exec(variant.src);
    const description = groupMatch && tags.description?.replace(
      /^(.*?)(\.?)$/,
      `$1 (image ${groupMatch[1]}).`,
    );
    await copy(photo.src, variant.src, description ? { description } : {});
  });
}

export function check(photo: Photo): string[] {
  const warnings: string[] = [];
  for (const field in omit(photo, ["city"])) {
    if (!(field in photo)) warnings.push(`missing:${field}`);
  }
  for (const variant of photo.variants) {
    for (
      const field in omit(variant, ["src", "width", "height", "description"])
    ) {
      if (field in variant) warnings.push(`${basename(variant.src)}:${field}`);
    }
  }
  return warnings;
}
