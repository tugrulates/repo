import { assertSnapshot } from "@std/testing/snapshot";
import { mockConsole, mockFetch } from "@tugrulates/testing";
import { main } from "./main.ts";

Deno.test(
  "lonely-planet --help",
  async (t) => {
    using console = mockConsole();
    await main(["lonely-planet", "--help"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet [keywords...]",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["lonely-planet", "the", "netherlands"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet [keywords...] --json",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["lonely-planet", "the", "netherlands", "--json"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet --destinations",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["lonely-planet", "--destinations", "amsterdam"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet --attractions",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["lonely-planet", "--attractions", "haarlem"]);
    await assertSnapshot(t, console.calls);
  },
);

Deno.test(
  "lonely-planet --stories",
  async (t) => {
    using console = mockConsole();
    using _fetch = mockFetch(t);
    await main(["lonely-planet", "--stories", "utrecht"]);
    await assertSnapshot(t, console.calls);
  },
);
