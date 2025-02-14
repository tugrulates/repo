import { fakeConsole, mockFetch } from "@roka/testing";
import { assertSnapshot } from "@std/testing/snapshot";
import { main } from "./main.ts";

Deno.test.ignore(
  "lonely-planet [keywords...]",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["the", "netherlands"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "lonely-planet [keywords...] --json",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["the", "netherlands", "--json"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "lonely-planet --destinations",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["--destinations", "amsterdam"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "lonely-planet --attractions",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["--attractions", "haarlem"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test.ignore(
  "lonely-planet --stories",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["--stories", "utrecht"]);
    await assertSnapshot(t, console.calls);
  },
);
