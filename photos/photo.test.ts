import { tempDirectory } from "@roka/testing/temp";
import { copy } from "@std/fs";
import { basename } from "@std/path";
import { join } from "@std/path/join";
import { assertSnapshot } from "@std/testing/snapshot";
import { type Photo, photo, sync } from "@tugrulates/photos/photo";

function stripPath(photo: Photo): Photo {
  return {
    ...photo,
    path: basename(photo.path),
    variants: photo.variants.map((v) => ({
      ...v,
      path: basename(v.path),
    })),
  };
}

Deno.test("photo() return EXIF with variants", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await using dir = await tempDirectory();
  await copy("photos/__testdata__", dir.path(), { overwrite: true });
  const src = await photo(join(dir.path(), "floating-around/source.jpg"));
  await assertSnapshot(t, stripPath(src));
});

Deno.test("sync() copies EXIF from source photo to variant", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await using dir = await tempDirectory();
  await copy("photos/__testdata__", dir.path(), { overwrite: true });
  const before = await photo(join(dir.path(), "winter-pause/source.jpg"));
  await assertSnapshot(t, stripPath(before));
  await sync(before);
  const after = await photo(join(dir.path(), "winter-pause/source.jpg"));
  await assertSnapshot(t, stripPath(after));
});
