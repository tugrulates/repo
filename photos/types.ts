/**
 * Represents the EXIF (Exchangeable Image File Format) metadata of a photo.
 *
 * This only lists the fields relevant for my photography workflow.
 */
export interface Exif {
  /** Source file for this photo. */
  src: string;
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
