import {
  assertEquals,
  assertExists,
  assertGreater,
  assertRejects,
} from "@std/assert";
import { omit } from "@std/collections/omit";
import { check } from "./photo.ts";
import { tempPhoto } from "./testing.ts";

Deno.test("testPhoto() returns a photo", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using photo = await tempPhoto();
  assertExists(photo.id);
  assertExists(photo.path);
  assertExists(photo.width);
  assertExists(photo.height);
  assertExists(photo.title);
  assertExists(photo.description);
  assertExists(photo.keywords);
  assertExists(photo.date);
  assertExists(photo.location);
  assertExists(photo.city);
  assertExists(photo.state);
  assertExists(photo.country);
  assertExists(photo.make);
  assertExists(photo.model);
  assertExists(photo.lens);
  assertExists(photo.software);
  assertExists(photo.license);
  assertGreater(photo.variants.length, 0);
  for (const variant of photo.variants) {
    assertExists(variant.path);
    assertExists(variant.width);
    assertExists(variant.height);
    assertEquals(
      omit(variant, ["path", "width", "height", "description"]),
      omit(photo, ["id", "variants", "path", "width", "height", "description"]),
    );
  }
});

Deno.test("testPhoto() returns a disposable photo", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  let path = null;
  {
    await using photo = await tempPhoto();
    path = photo.path;
  }
  await assertRejects(() => Deno.lstat(path), Deno.errors.NotFound);
});

Deno.test("testPhoto() returns a photo with given tags", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  await using other = await tempPhoto();
  await using photo = await tempPhoto({
    source: other.path,
    title: "test-title",
    keywords: ["test-keyword-1", "test-keyword-2"],
  });
  assertEquals(photo.title, "test-title");
  assertEquals(photo.keywords, ["test-keyword-1", "test-keyword-2"]);
  const warnings = check(photo);
  assertEquals(warnings, []);
});
