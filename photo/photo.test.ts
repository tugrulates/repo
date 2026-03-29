import { tempDirectory } from "@roka/fs/temp";
import { assertEquals, assertExists, assertObjectMatch } from "@std/assert";
import { copy } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import { write } from "./exif.ts";
import { check, photo, sync } from "./photo.ts";
import { tempPhoto } from "./testing.ts";

Deno.test("photo() can load from an image file", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using testPhoto = await tempPhoto({ title: "test-title" });
  await using directory = await tempDirectory();
  const path = join(directory.path(), "source.jpg");
  await copy(testPhoto.path, path);
  const source = await photo(path);
  assertObjectMatch(source, {
    id: basename(directory.path()),
    path,
    title: "test-title",
    variants: [],
  });
});

Deno.test("photo() can load from a directory", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using testPhoto = await tempPhoto();
  await using directory = await tempDirectory();
  const path = join(directory.path(), "source.jpg");
  await copy(testPhoto.path, path);
  const source = await photo(directory.path());
  assertObjectMatch(source, { path });
});

Deno.test("photo() can load variants", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using testPhoto = await tempPhoto({ title: "test-title" });
  assertExists(testPhoto.variants[0]);
  assertExists(testPhoto.variants[1]);
  await using directory = await tempDirectory();
  const path = join(directory.path(), "source.jpg");
  const variant1 = join(directory.path(), "variant1.jpg");
  const variant2 = join(directory.path(), "variant2.jpg");
  await copy(testPhoto.path, path);
  await copy(testPhoto.variants[0]?.path, variant1);
  await copy(testPhoto.variants[1]?.path, variant2);
  const source = await photo(directory.path());
  assertObjectMatch(source, {
    path,
    variants: [{ path: variant1, title: "test-title" }, {
      path: variant2,
      title: "test-title",
    }],
  });
});

Deno.test("check() accepts a photo without problems", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto();
  assertEquals(check(photo), []);
});

Deno.test("check() finds missing fields", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto({ title: "", keywords: [] });
  assertEquals(check(photo), ["missing:title", "missing:keywords"]);
});

Deno.test("check() ignores missing optional fields", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto({ city: "" });
  assertEquals(check(photo), []);
});

Deno.test("check() finds variant with different field values", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto();
  assertExists(photo.variants[0]);
  assertExists(photo.variants[1]);
  photo.variants[0].path = join(dirname(photo.path), "variant1.jpg");
  photo.variants[1].path = join(dirname(photo.path), "variant2.jpg");
  photo.variants[0].title = "test-title";
  photo.variants[1].keywords = ["test-keyword"];
  assertEquals(check(photo), ["variant1.jpg:title", "variant2.jpg:keywords"]);
});

Deno.test("check() ignores differing descriptions", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto();
  assertExists(photo.variants[0]);
  photo.variants[0].description = "test-description";
  assertEquals(check(photo), []);
});

Deno.test("sync() copies data from source to variants", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using data = await tempPhoto();
  assertExists(data.variants[0]);
  await write(data.variants[0].path, { title: "test-title" });
  const broken = await photo(data.path);
  assertEquals(check(broken), [`${basename(data.variants[0].path)}:title`]);
  await sync(broken);
  assertEquals(check(broken), []);
});
