import { assertEquals } from "@std/assert";
import { type Exif, exif, write } from "./exif.ts";
import { tempPhoto } from "./testing.ts";

function testExif() {
  return {
    title: "test-title",
    description: "test-description",
    keywords: ["test-keyword-1", "test-keyword-2"],
    date: "2000-01-01 00:00:00",
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
}

function assertExif(exif: Exif) {
  assertEquals(exif.title, "test-title");
  assertEquals(exif.description, "test-description");
  assertEquals(exif.keywords, ["test-keyword-1", "test-keyword-2"]);
  assertEquals(exif.date, "2000-01-01T00:00:00-08:00");
  assertEquals(exif.location, "test-location");
  assertEquals(exif.city, "test-city");
  assertEquals(exif.state, "test-state");
  assertEquals(exif.country, "test-country");
  assertEquals(exif.make, "test-make");
  assertEquals(exif.model, "test-model");
  assertEquals(exif.lens, "test-lens");
  assertEquals(exif.software, "test-software");
  assertEquals(exif.license, "test-license");
}

Deno.test("exif() returns photo tags", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto(testExif());
  assertExif(await exif(photo.path));
});

Deno.test("write() can update tags", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto();
  await write(photo.path, testExif());
  assertExif(await exif(photo.path));
});

Deno.test("write() can copy tags from a file", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo1 = await tempPhoto(testExif());
  await using photo2 = await tempPhoto();
  await write(photo2.path, { source: photo1.path });
  assertExif(await exif(photo2.path));
});
