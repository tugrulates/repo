// deno-lint-ignore-file no-console
import { mockFetch } from "@roka/http/testing";
import { fakeConsole } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli } from "./cli.ts";

const TESTS = [
  "feed",
  "feed --engage",
  "follows",
  "follows --follow",
  "follows --unfollow",
  "league",
  "league --follow",
];

for (const test of TESTS) {
  Deno.test(`duolingo ${test}`, {
    sanitizeOps: false,
    sanitizeResources: false,
  }, async (t) => {
    using console = fakeConsole();
    using fetch = mockFetch(t);
    const args = test.replace("<username>", "tugrulates").split(" ");
    await cli(args, {
      // Use ENV variables for recording, but fake credentials for replay.
      ...fetch.mode === "replay" ? { config: ":memory:" } : {},
    });
    await assertSnapshot(t, console.output({ wrap: "\n" }));
  });
}
