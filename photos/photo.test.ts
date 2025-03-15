import { tempDirectory } from "@roka/testing/temp";
import { copy } from "@std/fs";
import { basename } from "@std/path";
import { join } from "@std/path/join";
import { assertSnapshot } from "@std/testing/snapshot";
import { type Photo, photo, sync } from "@tugrulates/photos/photo";

function trimSource(photo: Photo): Photo {
  return {
    ...photo,
    src: basename(photo.src),
    variants: photo.variants.map((v) => ({
      ...v,
      src: basename(v.src),
    })),
  };
}

Deno.test("getPhoto()", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await using dir = await tempDirectory();
  await copy("photos/__testdata__", dir.path(), { overwrite: true });
  const src = await photo(join(dir.path(), "floating-around/source.jpg"));
  await assertSnapshot(t, trimSource(src));
});

Deno.test("copyExifToVariants()", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await using dir = await tempDirectory();
  await copy("photos/__testdata__", dir.path(), { overwrite: true });
  const before = await photo(join(dir.path(), "winter-pause/source.jpg"));
  await assertSnapshot(t, trimSource(before));
  await sync(before);
  const after = await photo(join(dir.path(), "winter-pause/source.jpg"));
  await assertSnapshot(t, trimSource(after));
});
