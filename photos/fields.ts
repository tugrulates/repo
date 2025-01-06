import type { Exif } from "./types.ts";

/** All extracted EXIF fields. */
export const FIELDS: (keyof Exif)[] = [
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
  "software",
  "license",
] as const;

/** EXIF fields that are supposed to be different in variants. */
export const VARIANT_FIELDS: (keyof Exif)[] = [
  "src",
  "width",
  "height",
  "description",
] as const;

/** EXIF fields that can be omitted. */
export const OPTIONAL_FIELDS: (keyof Exif)[] = [
  "city",
] as const;
