import { copy } from "@std/fs";
import { basename } from "@std/path";
import { join } from "@std/path/join";
import { assertSnapshot } from "@std/testing/snapshot";
import { copyExifToVariants, getPhoto, type Photo } from "@tugrulates/photos";
import { tempDir } from "../testing/temp.ts";

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

Deno.test(
  "getPhoto()",
  // @todo Fix the timer leaks.
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    await using dir = await tempDir();
    await copy("photos/testdata", dir.path, { overwrite: true });
    const photo = await getPhoto(join(dir.path, "floating-around/source.jpg"));
    await assertSnapshot(t, trimSource(photo));
  },
);

Deno.test(
  "copyExifToVariants()",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    await using dir = await tempDir();
    await copy("photos/testdata", dir.path, { overwrite: true });
    const before = await getPhoto(join(dir.path, "winter-pause/source.jpg"));
    await assertSnapshot(t, trimSource(before));
    await copyExifToVariants(before);
    const after = await getPhoto(join(dir.path, "winter-pause/source.jpg"));
    await assertSnapshot(t, trimSource(after));
  },
);
