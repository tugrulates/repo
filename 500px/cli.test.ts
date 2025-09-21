import { mockFetch } from "@roka/http/testing";
import { fakeArgs, fakeConsole, fakeEnv } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli } from "./cli.ts";

async function test(t: Deno.TestContext) {
  using _fetch = mockFetch(t);
  using _args = fakeArgs(
    t.name
      .replaceAll("<username>", "tugrulates")
      .split(" ").slice(1),
  );
  using _env = fakeEnv({});
  using console = fakeConsole();
  await cli();
  // deno-lint-ignore no-console
  await assertSnapshot(t, console.output({ wrap: "\n" }));
}

Deno.test("500px discover", test);
Deno.test("500px follows <username>", test);
Deno.test("500px photos <username>", test);
