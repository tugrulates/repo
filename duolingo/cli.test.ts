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
    let config: string[] = [];
    if (fetch.mode === "replay") {
      config = ["--username", "TugrulAtes", "--token", "token"];
    }
    const args = test.split(" ");
    await cli([...config, ...args]);
    await assertSnapshot(t, console.output({ wrap: "\n" }));
  });
}
