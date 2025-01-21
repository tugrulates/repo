import { assertSnapshot } from "@std/testing/snapshot";
import { fakeConsole, mockFetch } from "@tugrulates/testing";
import { main } from "./main.ts";

Deno.test(
  "lonely-planet --help",
  async (t) => {
    using console = fakeConsole();
    await main(["--help"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet [keywords...]",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["the", "netherlands"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet [keywords...] --json",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["the", "netherlands", "--json"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet --destinations",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["--destinations", "amsterdam"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet --attractions",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["--attractions", "haarlem"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet --stories",
  async (t) => {
    using console = fakeConsole();
    using _fetch = mockFetch(t);
    await main(["--stories", "utrecht"]);
    await assertSnapshot(t, console.calls);
  },
);
