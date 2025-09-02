import { mockFetch } from "@roka/http/testing";
import { assertEquals } from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import { client } from "./client.ts";

Deno.test("client() can authenticate", async (t) => {
  using fetch = mockFetch(t, { ignore: { headers: true } });
  const exercism = client("https://exercism.org", {
    token: fetch.mode === "replay"
      ? "token"
      : Deno.env.get("EXERCISM_TOKEN") ?? "token",
  });
  assertEquals(await exercism.token.validate(), true);
});

Deno.test("client() can list tracks unauthenticated", async (t) => {
  using _fetch = mockFetch(t, { ignore: { headers: true } });
  const exercism = client("https://exercism.org");
  const data = await exercism.tracks.list();
  await assertSnapshot(t, data);
});

Deno.test("client() can list exercises unauthenticated", async (t) => {
  using _fetch = mockFetch(t, { ignore: { headers: true } });
  const exercism = client("https://exercism.org");
  const data = await exercism.track("typescript").exercises.list();
  await assertSnapshot(t, data);
});
