/** All extracted EXIF fields. */
export const FIELDS = [
  "src",
  "width",
  "height",
  "title",
  "description",
  "keywords",
  "date",
  "location",
  "city",
  "state",
  "country",
  "camera",
  "lens",
  "editing",
  "license",
] as const;

/** EXIF fields that are supposed to be different in variants. */
export const VARIANT_FIELDS = [
  "src",
  "width",
  "height",
  "description",
] as const;

/** EXIF fields that can be omitted. */
export const OPTIONAL_FIELDS = [
  "city",
] as const;
