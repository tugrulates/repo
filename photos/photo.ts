import { pick } from "@std/collections";
import { basename, dirname, join } from "@std/path";
import { ExifDateTime, ExifTool, type Tags } from "exiftool-vendored";
import { FIELDS } from "./fields.ts";
import type { Exif, Photo } from "./types.ts";

interface PhotoTags extends Tags {
  State?: string;
  License?: string;
}

/**
 * Return an `exiftool` instance.
 *
 * @returns The system `exiftool` if it exists, bundled version otherwise.
 */
async function getExiftool(): Promise<ExifTool> {
  const command = new Deno.Command("exiftool", { args: ["-v"] });
  try {
    await command.output();
    return new ExifTool({ exiftoolPath: "exiftool" });
  } catch (e: unknown) {
    if (e instanceof Deno.errors.NotFound) {
      return new ExifTool();
    }
    throw e;
  }
}

function getDate(tags: Tags): string | undefined {
  const date = tags.DateTimeOriginal;
  if (date instanceof ExifDateTime) return date.toISOString();
  return date;
}

function getSoftwareAgent(tags: Tags): string | undefined {
  const history = tags.History;
  if (typeof history === "string") return history;
  return (Array.isArray(history) ? history : [history]).find((h) =>
    h?.Action === "produced"
  )?.SoftwareAgent;
}

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
  const exiftool = await getExiftool();
  const tags = await exiftool.read<PhotoTags>(src);
  return {
    src,
    width: tags.ImageWidth,
    height: tags.ImageHeight,
    title: tags.Headline,
    description: tags.ImageDescription,
    keywords: Array.isArray(tags.Keywords)
      ? tags.Keywords
      : tags.Keywords
      ? [tags.Keywords]
      : [],
    date: getDate(tags),
    location: tags.Location,
    city: tags.City,
    state: tags.State,
    country: tags.Country,
    camera: tags.Make && tags.Model && `${tags.Make} ${tags.Model}`,
    lens: tags.LensModel,
    software: getSoftwareAgent(tags),
    license: tags.License,
  };
}

/**
 * Copies the EXIF data from photo source to its variants.
 *
 * @param photo Photo data for managing EXIF.
 */
export async function copyExifToVariants(photo: Photo) {
  const exiftool = await getExiftool();
  await Promise.all(photo.variants.map(async (variant) => {
    const tags = await exiftool.read<PhotoTags>(photo.src);
    const groupMatch = /.*-(\d+).jpg/.exec(variant.src);
    const description = groupMatch && tags.ImageDescription?.replace(
      /^(.*?)(\.?)$/,
      `$1 (image ${groupMatch[1]}).`,
    );
    await exiftool.write(
      variant.src,
      {},
      {
        writeArgs: [
          "-tagsfromfile",
          photo.src,
          "-all",
          "-overwrite_original_in_place",
          ...(description ? [`-ImageDescription=${description}`] : []),
        ],
      },
    );
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
    id: basename(dirname(path)),
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
