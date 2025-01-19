import { copy } from "@std/fs";
import { basename } from "@std/path";
import { join } from "@std/path/join";
import { assertSnapshot } from "@std/testing/snapshot";
import { copyExifToVariants, getPhoto, type Photo } from "@tugrulates/photos";

async function getTestData() {
  const dir = await Deno.makeTempDir();
  await copy("photos/testdata", dir, { overwrite: true });
  return {
    dir,
    path: (path: string) => join(dir, path),
    [Symbol.asyncDispose]: () => Deno.remove(dir, { recursive: true }),
  };
}

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
    await using data = await getTestData();
    const photo = await getPhoto(data.path("floating-around/source.jpg"));
    await assertSnapshot(t, trimSource(photo));
  },
);

Deno.test(
  "copyExifToVariants()",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    await using data = await getTestData();
    const before = await getPhoto(data.path("winter-pause/source.jpg"));
    await assertSnapshot(t, trimSource(before));
    await copyExifToVariants(before);
    const after = await getPhoto(data.path("winter-pause/source.jpg"));
    await assertSnapshot(t, trimSource(after));
  },
);
