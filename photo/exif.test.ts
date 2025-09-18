import { assertObjectMatch } from "@std/assert";
import { exif, write } from "./exif.ts";
import { tempPhoto } from "./testing.ts";

const TEST_EXIF = {
  title: "test-title",
  description: "test-description",
  keywords: ["test-keyword-1", "test-keyword-2"],
  date: "2000-01-01T00:00:00-08:00",
  location: "test-location",
  city: "test-city",
  state: "test-state",
  country: "test-country",
  make: "test-make",
  model: "test-model",
  lens: "test-lens",
  software: "test-software",
  license: "test-license",
};

Deno.test("exif() returns photo tags", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto(TEST_EXIF);
  assertObjectMatch(await exif(photo.path), TEST_EXIF);
});

Deno.test("write() can update tags", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto();
  await write(photo.path, TEST_EXIF);
  assertObjectMatch(await exif(photo.path), TEST_EXIF);
});

Deno.test("write() can copy tags from a file", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo1 = await tempPhoto(TEST_EXIF);
  await using photo2 = await tempPhoto();
  await write(photo2.path, { source: photo1.path });
  assertObjectMatch(await exif(photo2.path), TEST_EXIF);
});
