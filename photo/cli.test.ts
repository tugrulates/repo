import { tempDirectory } from "@roka/fs/temp";
import { fakeConsole } from "@roka/testing/fake";
import { assertExists } from "@std/assert";
import { copy } from "@std/fs/copy";
import { dirname } from "@std/path";
import { assertSnapshot } from "@std/testing/snapshot";
import { photos } from "./cli.ts";
import { write } from "./exif.ts";
import { tempPhoto } from "./testing.ts";

const TESTS = [
  "[file]",
  "[photo]",
  "[directory]",
  "[photo1] [photo2]",
  "[photo] --json",
  "[photo] --sync",
];

for (const test of TESTS) {
  Deno.test(`photos ${test}`, {
    sanitizeOps: false,
    sanitizeResources: false,
  }, async (t) => {
    await using directory = await tempDirectory();
    const photo1 = await tempPhoto({ title: "Photo 1", model: "Model 1" });
    const photo2 = await tempPhoto({ title: "Photo 2", model: "" });
    assertExists(photo1.variants[0]);
    write(photo1.variants[0].path, { title: "Variant 1" });
    await Deno.mkdir(directory.path("photo1"));
    await Deno.mkdir(directory.path("photo2"));
    copy(dirname(photo1.path), directory.path("photo1"), { overwrite: true });
    copy(dirname(photo2.path), directory.path("photo2"), { overwrite: true });
    const args = test
      .replace("[file]", directory.path("photo1/source.jpg"))
      .replace("[photo]", directory.path("photo1"))
      .replace("[photo1]", directory.path("photo1"))
      .replace("[photo2]", directory.path("photo2"))
      .replace("[directory]", directory.path())
      .split(" ");
    using console = fakeConsole();
    await photos(args);
    // deno-lint-ignore no-console
    const output = console.output({ wrap: "\n" })
      .replaceAll(directory.path(), "[directory]");
    await assertSnapshot(t, output);
  });
}
