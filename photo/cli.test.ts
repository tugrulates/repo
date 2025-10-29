import { tempDirectory } from "@roka/fs/temp";
import { fakeArgs, fakeConsole } from "@roka/testing/fake";
import { assertExists } from "@std/assert";
import { copy } from "@std/fs/copy";
import { dirname } from "@std/path";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli } from "./cli.ts";
import { write } from "./exif.ts";
import { tempPhoto } from "./testing.ts";

const OPTIONS = { sanitizeOps: false, sanitizeResources: false };

async function test(t: Deno.TestContext) {
  await using directory = await tempDirectory();
  const photo1 = await tempPhoto({ title: "Photo 1", model: "Model 1" });
  const photo2 = await tempPhoto({ title: "Photo 2", model: "" });
  assertExists(photo1.variants[0]);
  write(photo1.variants[0].path, { title: "Variant 1" });
  await Deno.mkdir(directory.path("photo1"));
  await Deno.mkdir(directory.path("photo2"));
  copy(dirname(photo1.path), directory.path("photo1"), { overwrite: true });
  copy(dirname(photo2.path), directory.path("photo2"), { overwrite: true });
  using _args = fakeArgs(
    t.name
      .replaceAll("[file]", directory.path("photo1/source.jpg"))
      .replaceAll("[photo]", directory.path("photo1"))
      .replaceAll("[photo1]", directory.path("photo1"))
      .replaceAll("[photo2]", directory.path("photo2"))
      .replaceAll("[directory]", directory.path())
      .split(" ").slice(1),
  );
  using console = fakeConsole();
  await cli();
  // deno-lint-ignore no-console
  const output = console.output({ wrap: "\n" })
    .replaceAll(directory.path(), "[directory]");
  await assertSnapshot(t, output);
}

Deno.test("photos [file]", OPTIONS, test);
Deno.test("photos [photo]", OPTIONS, test);
Deno.test("photos [directory]", OPTIONS, test);
Deno.test("photos [photo1] [photo2]", OPTIONS, test);
Deno.test("photos [photo] --json", OPTIONS, test);
Deno.test("photos [photo] --sync", OPTIONS, test);
