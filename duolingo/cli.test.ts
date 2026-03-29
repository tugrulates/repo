import { mockFetch } from "@roka/http/testing";
import { fakeArgs, fakeConsole } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { cli, type CliOptions } from "./cli.ts";

const OPTIONS = { sanitizeResources: false };

async function test(t: Deno.TestContext) {
  const options: CliOptions = {};
  using fetch = mockFetch(t);
  if (fetch.mode === "replay") {
    // use ENV variables for recording, but fake credentials for replay
    options.username = "TugrulAtes";
    options.token = "token";
  }
  using _args = fakeArgs(t.name.split(" ").slice(1));
  using console = fakeConsole();
  await cli(options);
  // deno-lint-ignore no-console
  await assertSnapshot(t, console.output({ wrap: "\n" }));
}

Deno.test("duolingo feed", OPTIONS, test);
Deno.test("duolingo feed --engage", OPTIONS, test);
Deno.test("duolingo follows", OPTIONS, test);
Deno.test("duolingo follows --follow", OPTIONS, test);
Deno.test("duolingo follows --unfollow", OPTIONS, test);
Deno.test("duolingo league", OPTIONS, test);
Deno.test("duolingo league --follow", OPTIONS, test);
