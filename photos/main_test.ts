import { copy } from "@std/fs";
import { join } from "@std/path";
import { assertSnapshot } from "@std/testing/snapshot";
import { mockConsole } from "@tugrulates/testing";
import { main } from "./main.ts";

Deno.test(
  "photos --help",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = mockConsole();
    await main(["--help"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photo]",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = mockConsole();
    await main(["photos/testdata/floating-around"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photos]",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = mockConsole();
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
    using console = mockConsole();
    await main(["photos/testdata/floating-around/source.jpg"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photo] --json",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    using console = mockConsole();
    await main(["photos/testdata/floating-around", "--json"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "photos [photo] --copy",
  { sanitizeOps: false, sanitizeResources: false },
  async (t) => {
    const dir = await Deno.makeTempDir();
    try {
      await copy("photos/testdata", dir, { overwrite: true });
      const photo = join(dir, "winter-pause");
      await t.step("before", async () => {
        using console = mockConsole();
        await main([photo]);
        await assertSnapshot(t, console.calls);
      });

      await t.step("copy", async () => {
        using console = mockConsole();
        await main([photo, "--copy"]);
        await assertSnapshot(t, console.calls);
      });

      await t.step("after", async () => {
        using console = mockConsole();
        await main([photo]);
        await assertSnapshot(t, console.calls);
      });
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
);
