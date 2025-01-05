import $ from "@david/dax";
import { pick } from "@std/collections";
import { basename, dirname, join } from "@std/path";
import { FIELDS } from "./fields.ts";
import type { Exif, Photo } from "./types.ts";

const EXIFTOOL = ["exiftool", "-q", "-overwrite_original_in_place"];

/**
 * Returns the EXIF data for the file.
 *
 * @param src File to get EXIF data for.
 * @returns EXIF data for the file.
 *
 * @todo This checks if the original date/time has an offset and uses the
 * create date if not. This is a workaround for Affinity Photo not filing
 * timezones.
 */
async function getExif(src: string): Promise<Exif> {
  const lines = await $`${EXIFTOOL} -d "%Y-%m-%dT%H:%M:%S%z" ${src}`.lines();
  const data = Object.fromEntries(
    lines.map((line) => line.match(/^([^:]+?)\s*:\s*(.*?)$/)?.slice(1) ?? []),
  );
  return {
    src,
    width: parseInt(data["Image Width"]),
    height: parseInt(data["Image Height"]),
    title: data["Title (en)"],
    description: data["Image Description"],
    keywords: data["Keywords"]?.split(",").map((s: string) => s.trim()),
    date: data["Offset Time Original"]
      ? data["Date/Time Original"]
      : data["Create Date"],
    location: data["Location"],
    city: data["City"],
    state: data["State"],
    country: data["Country"],
    camera: data["Camera Model Name"],
    lens: data["Lens Model"],
    editing: data["History Software Agent"],
    license: data["License"],
  };
}

/**
 * Copies the EXIF data from photo source to its variants.
 *
 * @param photo Photo data for managing EXIF.
 */
export async function copyExifToVariants(photo: Photo) {
  const baseArgs =
    await $`${EXIFTOOL} -CreateDate -ImageDescription ${photo.src} -args`
      .lines();
  await Promise.all(photo.variants.map(async (variant) => {
    const groupMatch = /.*-(\d+).jpg/.exec(variant.src);
    const args = baseArgs.map((arg) =>
      arg
        .replace(/^-CreateDate=/, "-SubSecDateTimeOriginal=")
        .replace(
          /^(-ImageDescription=.*?)(\.?)$/,
          groupMatch ? `$1 (image ${groupMatch[1]}).` : "$1$2",
        )
    );
    await $`${EXIFTOOL} -tagsfromfile ${photo.src} -codedcharacterset=UTF8 ${args} -all ${variant.src}`;
  }));
}

/**
 * Returns a list of all JPG files in the directory.
 *
 * @param dir Directory to check.
 * @returns List of all JPG files in the directory.
 */
async function getFiles(dir: string): Promise<string[]> {
  return (await Array.fromAsync(Deno.readDir(dir)))
    .filter((f) => f.isFile)
    .filter((f) => f.name.endsWith(".jpg"))
    .map((f) => join(dir, f.name))
    .toSorted();
}

/**
 * Returns the data for a photo using a single file.
 *
 * @param path Source photo to get information for.
 * @returns Data for the photo or file.
 */
export async function getPhoto(path: string): Promise<Photo> {
  const files = await getFiles(dirname(path));
  const exif = await Promise.all(files.map((f) => getExif(f)));
  const photo = exif.find((e) => e.src === path);
  if (!photo) throw new Error(`EXIF cannot be extracted for ${path}.`);
  return {
    id: basename(path),
    ...photo,
    variants: exif.filter((e) => e.src !== path).map((data) => ({
      ...pick(
        data,
        FIELDS.filter((f) =>
          JSON.stringify(photo[f]) !== JSON.stringify(data[f])
        ),
      ),
      src: data.src,
      width: data.width,
      height: data.height,
    })),
  };
}
