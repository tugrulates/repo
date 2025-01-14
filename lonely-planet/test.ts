import { assertSnapshot } from "@std/testing/snapshot";
import { LonelyPlanetClient } from "@tugrulates/lonely-planet";
import { mockFetch } from "@tugrulates/testing";

Deno.test("searchDestinations", async (t) => {
  using _fetch = mockFetch(t);
  const client = new LonelyPlanetClient();
  const results = await Array.fromAsync(
    client.searchDestinations(["big", "sur"]),
  );
  await assertSnapshot(t, results);
});

Deno.test("searchAttractions", async (t) => {
  using _fetch = mockFetch(t);
  const client = new LonelyPlanetClient();
  const results = await Array.fromAsync(
    client.searchAttractions(["big", "sur"]),
  );
  await assertSnapshot(t, results);
});

Deno.test("searchStories", async (t) => {
  using _fetch = mockFetch(t);
  const client = new LonelyPlanetClient();
  const results = await Array.fromAsync(
    client.searchStories(["big", "sur"]),
  );
  await assertSnapshot(t, results);
});
