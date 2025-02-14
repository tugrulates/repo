import { fakeConsole, mockFetch } from "@roka/testing";
import { assertSnapshot } from "@std/testing/snapshot";
import { main } from "./main.ts";

Deno.test.ignore(
  "500px discover",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["discover"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "500px follows <username>",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["follows", "tugrulates"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "500px photos <username>",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["photos", "tugrulates"]);
    await assertSnapshot(t, console.calls);
  },
);
