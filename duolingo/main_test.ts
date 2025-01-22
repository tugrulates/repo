import { assertSnapshot } from "@std/testing/snapshot";
import { fakeConsole, getMockMode, mockFetch } from "@tugrulates/testing";
import { main } from "./main.ts";

// Use ENV variables for recording, but fake credentials for replay.
const CONFIG = [] as string[];
if (getMockMode() === "replay") {
  CONFIG.push("--username", "TugrulAtes", "--token", "TOKEN");
}

Deno.test(
  "duolingo feed",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "feed"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "duolingo feed --engage",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "feed", "--engage"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "duolingo follows",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "follows"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "duolingo follows --follow",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "follows", "--follow"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "duolingo follows --unfollow",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "follows", "--unfollow"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "duolingo league",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "league"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "duolingo league --follow",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main([...CONFIG, "league", "--follow"], { path: ":memory:" });
    await assertSnapshot(t, console.calls);
  },
);
