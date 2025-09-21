import { mockFetch } from "@roka/http/testing";
import { fakeArgs, fakeConsole } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli } from "./cli.ts";

async function test(t: Deno.TestContext) {
  using _fetch = mockFetch(t);
  using _args = fakeArgs(
    t.name
      .replaceAll("[keywords...]", "the netherlands")
      .replaceAll("[keyword]", "amsterdam")
      .split(" ").slice(1),
  );
  using console = fakeConsole();
  await cli();
  // deno-lint-ignore no-console
  await assertSnapshot(t, console.output({ wrap: "\n" }));
}

Deno.test("lonely-planet [keywords...]", test);
Deno.test("lonely-planet [keywords...] --json", test);
Deno.test("lonely-planet --destinations [keyword]", test);
Deno.test("lonely-planet --attractions [keyword]", test);
Deno.test("lonely-planet --stories [keyword]", test);
