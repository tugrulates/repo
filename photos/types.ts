/**
 * Represents the EXIF (Exchangeable Image File Format) metadata of a photo.
 *
 * This only lists the fields relevant for my photography workflow.
 */
export interface Exif {
  /** Source file for this photo. */
  src: string;
  /** The pixel width of the photo. */
  width?: number;
  /** The pixel height of the photo. */
  height?: number;
  /** The title of the photo. */
  title?: string;
  /** Text describing the contents of the photo. */
  description?: string;
  /** Keywords for findability. */
  keywords?: string[];
  /** The date the photo was taken. */
  date?: string;
  /** The location where the photo was taken. */
  location?: string;
  /** The city that the photo was taken in. */
  city?: string;
  /** The state that the photo was taken in. */
  state?: string;
  /** The country that the photo was taken in. */
  country?: string;
  /** The camera or phone used to take the photo. */
  camera?: string;
  /** Lens properties that were used to take the photo. */
  lens?: string;
  /** The software used to edit the photo. */
  editing?: string;
  /** The license of the photo. */
  license?: string;
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
