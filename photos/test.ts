import { copy } from "@std/fs";
import { basename } from "@std/path";
import { join } from "@std/path/join";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSnapshot } from "@std/testing/snapshot";
import { copyExifToVariants, getPhoto, type Photo } from "@tugrulates/photos";

// @todo Fix the timer leaks.
describe("photos", { sanitizeOps: false, sanitizeResources: false }, () => {
  let tmpDirectory: string;

  beforeEach(async () => {
    tmpDirectory = await Deno.makeTempDir();
    await copy("photos/testdata", tmpDirectory, { overwrite: true });
  });

  afterEach(async () => {
    await Deno.remove(tmpDirectory, { recursive: true });
  });

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

  it("getPhoto()", async (t) => {
    const photo = await getPhoto(
      join(tmpDirectory, "floating-around/source.jpg"),
    );
    await assertSnapshot(t, trimSource(photo));
  });

  it("copyExifToVariants()", async (t) => {
    const before = await getPhoto(
      join(tmpDirectory, "winter-pause/source.jpg"),
    );
    await assertSnapshot(t, trimSource(before));
    await copyExifToVariants(before);
    const after = await getPhoto(join(tmpDirectory, "winter-pause/source.jpg"));
    await assertSnapshot(t, trimSource(after));
  });
});
