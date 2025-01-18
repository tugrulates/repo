import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertSnapshot } from "@std/testing/snapshot";
import { LonelyPlanetClient } from "@tugrulates/lonely-planet";
import { mockFetch } from "@tugrulates/testing";

describe("LonelyPlanetClient", () => {
  let client: LonelyPlanetClient;

  beforeEach(() => {
    client = new LonelyPlanetClient();
  });

  it("searchDestinations()", async (t) => {
    using _fetch = mockFetch(t);
    const results = await Array.fromAsync(
      client.searchDestinations(["big", "sur"]),
    );
    await assertSnapshot(t, results);
  });

  it("searchAttractions()", async (t) => {
    using _fetch = mockFetch(t);
    const results = await Array.fromAsync(
      client.searchAttractions(["big", "sur"]),
    );
    await assertSnapshot(t, results);
  });

  it("searchStories()", async (t) => {
    using _fetch = mockFetch(t);
    const results = await Array.fromAsync(
      client.searchStories(["big", "sur"]),
    );
    await assertSnapshot(t, results);
  });
});
