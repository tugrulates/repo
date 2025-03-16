/**
 * This modules provides operations to work with EXIF (Exchangeable Image File
 * Format) tags on image files.
 *
 * @module exif
 */

import { which } from "@david/which";
import { assertEquals } from "@std/assert";
import { mapValues, omit } from "@std/collections";
import { ExifDateTime, ExifTool, type Tags } from "exiftool-vendored";

/**
 * The tags returned from the {@linkcode exif} function.
 *
 * This only lists the fields relevant for my photography workflow.
 */
export interface Exif {
  /** The pixel width of the photo. */
  width?: number | undefined;
  /** The pixel height of the photo. */
  height?: number | undefined;
  /** The title of the photo. */
  title?: string | undefined;
  /** Text describing the contents of the photo. */
  description?: string | undefined;
  /** Keywords for findability. */
  keywords?: string[] | undefined;
  /** The date the photo was taken. */
  date?: string | undefined;
  /** The location where the photo was taken. */
  location?: string | undefined;
  /** The city that the photo was taken in. */
  city?: string | undefined;
  /** The state that the photo was taken in. */
  state?: string | undefined;
  /** The country that the photo was taken in. */
  country?: string | undefined;
  /** The make of the camera or phone used to take the photo. */
  make?: string | undefined;
  /** The model of the camera or phone used to take the photo. */
  model?: string | undefined;
  /** Lens properties that were used to take the photo. */
  lens?: string | undefined;
  /** The software used to edit the photo. */
  software?: string | undefined;
  /** The license of the photo. */
  license?: string | undefined;
}

/** Options for the {@linkcode write} function. */
export interface WriteOptions extends Omit<Exif, "width" | "height"> {
  /**
   * Copy tags from given file.
   *
   * The tags that are explicitly specified override the copied tags.
   */
  source?: string;
}

// remove when https://github.com/denoland/deno/issues/28440 is fixed
class manager {
  static exiftool?: ExifTool = undefined;
  static async get() {
    if (this.exiftool) return this.exiftool;
    const exiftoolPath = await which("exiftool");
    this.exiftool = new ExifTool({ ...exiftoolPath ? { exiftoolPath } : {} });
    addEventListener(
      "unload",
      () => this.exiftool?.end(),
    );
    return this.exiftool;
  }
}
// await using manager = {
//   exiftool: undefined as ExifTool | undefined,
//   async get() {
//     if (this.exiftool) return this.exiftool;
//     const exiftoolPath = await which("exiftool");
//     this.exiftool = new ExifTool({ ...exiftoolPath ? { exiftoolPath } : {} });
//     return this.exiftool;
//   },
//   async [Symbol.asyncDispose]() {
//     return await this.exiftool?.end();
//   },
// };

/**
 * Retrieves tags from a photo file.
 *
 * This checks if the original date/time has an offset and uses the
 * create date if not. This is a workaround for Affinity Photo not filing
 * timezones.
 */
export async function exif(src: string): Promise<Exif> {
  const exiftool = await manager.get();
  const tags = await exiftool.read<PhotoTags>(src);
  return mapValues(
    MAPPING,
    ({ tag, get }) => get ? get(tags) : tags[tag],
  ) as Exif;
}

/** Write tags to a photo file. */
export async function write(path: string, options?: WriteOptions) {
  const exiftool = await manager.get();
  const tags = omit(options ?? {}, ["source"]);
  const result = await exiftool.write(path, {}, {
    writeArgs: [
      ...options?.source ? ["-tagsfromfile", options.source, "-all"] : [],
      "-overwrite_original_in_place",
      ...Object.keys(tags).map((key) => `-${MAPPING[key as keyof Exif]?.tag}=`),
      ...Object.entries(tags).map(([key, value]) =>
        (Array.isArray(value) ? value : [value])
          .map((x) => `-${MAPPING[key as keyof Exif]?.tag}=${x}`)
      ).flat(),
    ],
  });
  assertEquals(result.updated, 1);
}

interface PhotoTags extends Tags {
  State?: string;
  HistorySoftwareAgent?: string;
  License?: string;
}

type Mapping = {
  [K in keyof Exif]: {
    tag: keyof PhotoTags;
    get?(tags: PhotoTags): Exif[K];
  };
};

const MAPPING: Mapping = {
  width: { tag: "ImageWidth" },
  height: { tag: "ImageHeight" },
  title: { tag: "Headline" },
  description: { tag: "ImageDescription" },
  keywords: {
    tag: "Keywords",
    get(tags) {
      return Array.isArray(tags.Keywords)
        ? tags.Keywords
        : tags.Keywords
        ? [tags.Keywords]
        : [];
    },
  },
  date: {
    tag: "DateTimeOriginal",
    get(tags) {
      const date = tags.DateTimeOriginal;
      if (date instanceof ExifDateTime) return date.toISOString();
      return date;
    },
  },
  location: { tag: "Location" },
  city: { tag: "City" },
  state: { tag: "State" },
  country: { tag: "Country" },
  make: { tag: "Make" },
  model: { tag: "Model" },
  lens: { tag: "LensModel" },
  software: {
    tag: "HistorySoftwareAgent",
    get(tags) {
      const history = tags.History;
      if (typeof history === "string") return history;
      return (Array.isArray(history) ? history : [history]).find((h) =>
        h?.Action === "produced"
      )?.SoftwareAgent;
    },
  },
  license: { tag: "License" },
};
