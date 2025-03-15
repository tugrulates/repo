import { which } from "@david/which";
import { mapValues } from "@std/collections";
import { ExifDateTime, ExifTool, type Tags } from "exiftool-vendored";

/**
 * The EXIF data returned from the {@linkcode exif} function.
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

/**
 * Returns the EXIF (Exchangeable Image File Format) metadata of a photo.
 *
 * @todo This checks if the original date/time has an offset and uses the
 * create date if not. This is a workaround for Affinity Photo not filing
 * timezones.
 */
export async function exif(src: string): Promise<Exif> {
  const exiftool = await ExifToolManager.get();
  const tags = await exiftool.read<PhotoTags>(src);
  return mapValues(
    MAPPING,
    ({ tag, get }) => get ? get(tags) : tags[tag],
  ) as Exif;
}

/**
 * Copies the EXIF data from photo source to its variants.
 *
 * @param src Source photo to copy EXIF data from.
 * @param dst Destination photo to copy EXIF data to.
 * @param exif Optional EXIF data to overwrite.
 */
export async function copy(
  src: string,
  dst: string,
  exif?: Partial<Omit<Exif, "width" | "height">>,
) {
  const exiftool = await ExifToolManager.get();
  await exiftool.write(dst, {}, {
    writeArgs: [
      "-tagsfromfile",
      src,
      "-all",
      "-overwrite_original_in_place",
      ...Object.entries(exif ?? {}).map(([key, value]) =>
        `-${MAPPING[key as keyof Exif]?.tag}=${value}`
      ),
    ],
  });
}

interface PhotoTags extends Tags {
  State?: string;
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
    tag: "Software",
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

class ExifToolManager {
  static exiftool?: ExifTool = undefined;

  static async get() {
    if (this.exiftool) return this.exiftool;
    const exiftoolPath = await which("exiftool");
    this.exiftool = new ExifTool({ ...exiftoolPath ? { exiftoolPath } : {} });
    addEventListener("unload", () => this.exiftool?.end());
    return this.exiftool;
  }
}
