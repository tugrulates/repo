// deno-lint-ignore-file no-console
import { mockFetch } from "@roka/http/testing";
import { fakeConsole } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli } from "./cli.ts";

const TESTS = [
  "discover",
  "follows <username>",
  "photos <username>",
];

for (const test of TESTS) {
  Deno.test(`500px ${test}`, {
    sanitizeOps: false,
    sanitizeResources: false,
  }, async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    const args = test.replace("<username>", "tugrulates").split(" ");
    await cli(args);
    await assertSnapshot(t, console.output({ wrap: "\n" }));
  });
}
