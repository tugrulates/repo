// deno-lint-ignore-file no-console
import { config } from "@roka/cli/config";
import { mockFetch } from "@roka/http/testing";
import { fakeConsole } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli, type CliOptions } from "./cli.ts";

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
    const options: CliOptions = {};
    using fetch = mockFetch(t);
    if (fetch.mode === "replay") {
      // Use ENV variables for recording, but fake credentials for replay.
      options.config = config<{ username: string; token: string }>({
        path: ":memory:",
      });
      await options.config.set({ username: "TugrulAtes", token: "token" });
    }
    using console = fakeConsole();
    const args = test.replace("<username>", "tugrulates").split(" ");
    await cli(args, options);
    await assertSnapshot(t, console.output({ wrap: "\n" }));
  });
}
