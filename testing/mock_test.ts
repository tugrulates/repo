import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import { mockFetch } from "@tugrulates/testing";

Deno.test("mockFetch", async (t) => {
  using _mock = mockFetch(t);
  const response = await fetch("https://example.com");
  assertEquals(response.status, 200);
  await assertSnapshot(t, await response.text());
});

Deno.test("mockFetch: multiple calls", async (t) => {
  using _mock = mockFetch(t);
  await Promise.all([
    fetch("https://example.com"),
    fetch("https://example.com"),
    fetch("http://example.com"),
  ]);
});

Deno.test("mockFetch: missing call", async (t) => {
  using _mock = mockFetch(t);
  // never record mocks for this test
  if (Deno.args.includes("--update")) return;
  await assertRejects(async () => await fetch("https://example.com"));
});

Deno.test("mockFetch: extra call", async (t) => {
  using _mock = mockFetch(t);
  // this call be recored into mock
  await fetch("https://example.com");
  // next fetch call will not be found in mock
  if (Deno.args.includes("--update")) return;
  await assertRejects(async () => await fetch("https://example.com"));
});

Deno.test("mockFetch: not called", async (t) => {
  const mock = mockFetch(t);
  try {
    // this call be recored into mock, but not replayed
    if (Deno.args.includes("--update")) {
      await fetch("https://example.com");
    }
  } finally {
    if (Deno.args.includes("--update")) mock.restore();
    else assertThrows(() => mock.restore());
  }
});
