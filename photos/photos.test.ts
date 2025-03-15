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
  await test(t, ["photos/__testdata__/floating-around"]);
});

Deno.test("photos [photos]", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await test(t, [
    "photos/__testdata__/floating-around",
    "photos/__testdata__/winter-pause",
  ]);
});

Deno.test("photos [file]", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await test(t, ["photos/__testdata__/floating-around/source.jpg"]);
});

Deno.test("photos [photo] --json", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await test(t, ["photos/__testdata__/floating-around", "--json"]);
});

Deno.test("photos [photo] --copy", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  await using dir = await tempDirectory();
  await copy("photos/__testdata__", dir.path(), { overwrite: true });
  const photo = join(dir.path(), "winter-pause");
  await t.step("before", (t) => test(t, [photo]));
  await t.step("copy", (t) => test(t, [photo, "--copy"]));
  await t.step("after", (t) => test(t, [photo]));
});

async function test(t: Deno.TestContext, args: string[]) {
  using console = fakeConsole();
  await photos(args);
  await assertSnapshot(t, console.output());
}
