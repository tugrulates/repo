// deno-lint-ignore-file no-console
import { fakeConsole } from "@roka/testing/fake";
import { tempDirectory } from "@roka/testing/temp";
import { copy } from "@std/fs";
import { join } from "@std/path";
import { assertSnapshot } from "@std/testing/snapshot";
import { photos } from "@tugrulates/photos";

Deno.test("photos [photo]", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using console = fakeConsole();
  await photos(["photos/__testdata__/floating-around"]);
  await assertSnapshot(t, console.output());
});

Deno.test("photos [photos]", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using console = fakeConsole();
  await photos([
    "photos/__testdata__/floating-around",
    "photos/__testdata__/winter-pause",
  ]);
  await assertSnapshot(t, console.output());
});

Deno.test("photos [file]", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using console = fakeConsole();
  await photos(["photos/__testdata__/floating-around/source.jpg"]);
  await assertSnapshot(t, console.output());
});

Deno.test("photos [photo] --json", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using console = fakeConsole();
  await photos(["photos/__testdata__/floating-around", "--json"]);
  await assertSnapshot(t, console.output());
});

Deno.test("photos [photo] --copy", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await using dir = await tempDirectory();
  await copy("photos/__testdata__", dir.path(), { overwrite: true });
  const photo = join(dir.path(), "winter-pause");
  await t.step("before", async () => {
    using console = fakeConsole();
    await photos([photo]);
    await assertSnapshot(t, console.output());
  });
  await t.step("copy", async () => {
    using console = fakeConsole();
    await photos([photo, "--copy"]);
    await assertSnapshot(t, console.output());
  });
  await t.step("after", async () => {
    using console = fakeConsole();
    await photos([photo]);
    await assertSnapshot(t, console.output());
  });
});
