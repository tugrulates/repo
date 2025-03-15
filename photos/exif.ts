import { which } from "@david/which";
import { ExifDateTime, ExifTool, type Tags } from "exiftool-vendored";

/**
 * Represents the EXIF (Exchangeable Image File Format) metadata of a photo.
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
  /** The camera or phone used to take the photo. */
  camera?: string | undefined;
  /** Lens properties that were used to take the photo. */
  lens?: string | undefined;
  /** The software used to edit the photo. */
  software?: string | undefined;
  /** The license of the photo. */
  license?: string | undefined;
}

/**
 * Returns the EXIF data for the file.
 *
 * @todo This checks if the original date/time has an offset and uses the
 * create date if not. This is a workaround for Affinity Photo not filing
 * timezones.
 */
export async function exif(src: string): Promise<Exif> {
  const exiftool = await ExifToolManager.get();
  const tags = await exiftool.read<PhotoTags>(src);
  return {
    width: tags.ImageWidth,
    height: tags.ImageHeight,
    title: tags.Headline,
    description: tags.ImageDescription,
    keywords: Array.isArray(tags.Keywords)
      ? tags.Keywords
      : tags.Keywords
      ? [tags.Keywords]
      : [],
    date: dateFromTags(tags),
    location: tags.Location,
    city: tags.City,
    state: tags.State,
    country: tags.Country,
    camera: tags.Make && tags.Model && `${tags.Make} ${tags.Model}`,
    lens: tags.LensModel,
    software: softwareAgentFromTags(tags),
    license: tags.License,
  };
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
  exif?: Partial<Exif>,
) {
  const exiftool = await ExifToolManager.get();
  await exiftool.write(dst, {}, {
    writeArgs: [
      "-tagsfromfile",
      src,
      "-all",
      "-overwrite_original_in_place",
      ...(exif?.description ? [`-ImageDescription=${exif.description}`] : []),
    ],
  });
}

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

interface PhotoTags extends Tags {
  State?: string;
  License?: string;
}

function dateFromTags(tags: Tags): string | undefined {
  const date = tags.DateTimeOriginal;
  if (date instanceof ExifDateTime) return date.toISOString();
  return date;
}

function softwareAgentFromTags(tags: Tags): string | undefined {
  const history = tags.History;
  if (typeof history === "string") return history;
  return (Array.isArray(history) ? history : [history]).find((h) =>
    h?.Action === "produced"
  )?.SoftwareAgent;
}
