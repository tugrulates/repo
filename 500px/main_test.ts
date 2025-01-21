import { assertSnapshot } from "@std/testing/snapshot";
import { mockConsole, mockFetch } from "@tugrulates/testing";
import { main } from "./main.ts";

Deno.test(
  "500px --help",
  async (t) => {
    using console = mockConsole();
    await main(["--help"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "500px discover",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["discover"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "500px follows <username>",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["follows", "tugrulates"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "500px photos <username>",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["photos", "tugrulates"]);
    await assertSnapshot(t, console.calls);
  },
);