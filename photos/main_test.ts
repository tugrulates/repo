import { copy } from "@std/fs";
import { join } from "@std/path";
import { assertSnapshot } from "@std/testing/snapshot";
import { fakeConsole, tempDir } from "@tugrulates/testing";
import { main } from "./main.ts";

Deno.test(
  "photos [photo]",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = fakeConsole();
    await main(["photos/testdata/floating-around"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photos]",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = fakeConsole();
    await main([
      "photos/testdata/floating-around",
      "photos/testdata/winter-pause",
    ]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [file]",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = fakeConsole();
    await main(["photos/testdata/floating-around/source.jpg"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photo] --json",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = fakeConsole();
    await main(["photos/testdata/floating-around", "--json"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photo] --copy",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    await using dir = await tempDir();

    await copy("photos/testdata", dir.path, { overwrite: true });
    const photo = join(dir.path, "winter-pause");
    await t.step("before", async () => {
      using console = fakeConsole();
      await main([photo]);
      await assertSnapshot(t, console.calls);
    });

    await t.step("copy", async () => {
      using console = fakeConsole();
      await main([photo, "--copy"]);
      await assertSnapshot(t, console.calls);
    });

    await t.step("after", async () => {
      using console = fakeConsole();
      await main([photo]);
      await assertSnapshot(t, console.calls);
    });
  },
);
