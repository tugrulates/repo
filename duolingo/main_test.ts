// deno-lint-ignore-file no-console
import { mockFetch } from "@roka/http/testing";
import { fakeConsole } from "@roka/testing/fake";
import type { Mock } from "@roka/testing/mock";
import { assertSnapshot } from "@std/testing/snapshot";
import { main } from "./main.ts";

// Use ENV variables for recording, but fake credentials for replay.
const CONFIG = ["--username", "TugrulAtes", "--token", "TOKEN"];

function config(mock: Mock<typeof fetch>) {
  if (mock.mode === "replay") {
    return CONFIG;
  }
  return [];
}

Deno.test("duolingo feed", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "feed"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});

Deno.test("duolingo feed --engage", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "feed", "--engage"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});

Deno.test("duolingo follows", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "follows"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});

Deno.test("duolingo follows --follow", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "follows", "--follow"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});

Deno.test("duolingo follows --unfollow", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "follows", "--unfollow"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});

Deno.test("duolingo league", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "league"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});

Deno.test("duolingo league --follow", async (t) => {
  using console = fakeConsole();
  using fetch = mockFetch(t);
  await main([...config(fetch), "league", "--follow"], { path: ":memory:" });
  await assertSnapshot(t, console.calls);
});
