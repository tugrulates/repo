import { mockFetch } from "@roka/http/testing";
import { fakeConsole } from "@roka/testing/fake";
import { assertSnapshot } from "@std/testing/snapshot";
import { main } from "./main.ts";

Deno.test("500px discover", async (t) => {
  using console = fakeConsole();
  using _fetch = mockFetch(t);
  await main(["discover"]);
  await assertSnapshot(t, console.calls);
});

Deno.test("500px follows <username>", async (t) => {
  using console = fakeConsole();
  using _fetch = mockFetch(t);
  await main(["follows", "tugrulates"]);
  await assertSnapshot(t, console.calls);
});

Deno.test("500px photos <username>", async (t) => {
  using console = fakeConsole();
  using _fetch = mockFetch(t);
  await main(["photos", "tugrulates"]);
  await assertSnapshot(t, console.calls);
});
