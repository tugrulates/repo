// deno-lint-ignore-file no-console
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
    using console = fakeConsole();
    using fetch = mockFetch(t);
    const options: CliOptions = {};
    if (fetch.mode === "replay") {
      // use ENV variables for recording, but fake credentials for replay
      options.username = "TugrulAtes";
      options.token = "token";
    }
    const args = test.split(" ");
    await cli(args, options);
    await assertSnapshot(t, console.output({ wrap: "\n" }));
  });
}
