import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import {
  getMockMode,
  mockConsole,
  MockError,
  mockFetch,
} from "@tugrulates/testing";

Deno.test("mockConsole() stubs console", () => {
  using mock = mockConsole();
  console.debug("Hello, Debug!");
  console.log("Hello, Log!");
  console.info("Hello, Info!");
  console.warn("Hello, Warn!");
  console.error("Hello, Error!");
  assertEquals(mock.calls, [
    { level: "debug", data: ["Hello, Debug!"] },
    { level: "log", data: ["Hello, Log!"] },
    { level: "info", data: ["Hello, Info!"] },
    { level: "warn", data: ["Hello, Warn!"] },
    { level: "error", data: ["Hello, Error!"] },
  ]);
});

Deno.test("mockConsole() implements spy like interface", () => {
  const console = mockConsole();
  try {
    console.debug("Hello, Debug!");
    console.log("Hello, Log!");
    console.info("Hello, Info!");
    console.warn("Hello, Warn!");
    console.error("Hello, Error!");
    assertEquals(console.calls, [
      { level: "debug", data: ["Hello, Debug!"] },
      { level: "log", data: ["Hello, Log!"] },
      { level: "info", data: ["Hello, Info!"] },
      { level: "warn", data: ["Hello, Warn!"] },
      { level: "error", data: ["Hello, Error!"] },
    ]);
    assertFalse(console.restored);
  } finally {
    console.restore();
    assert(console.restored);
  }
});

Deno.test("mockConsole() captures multiple calls", () => {
  using console = mockConsole();
  console.debug("First!");
  console.debug("Second!");
  assertEquals(console.calls, [
    { level: "debug", data: ["First!"] },
    { level: "debug", data: ["Second!"] },
  ]);
});

Deno.test("mockConsole() captures multiple arguments", () => {
  using console = mockConsole();
  console.debug("First!", "Second!");
  assertEquals(console.calls, [
    { level: "debug", data: ["First!", "Second!"] },
  ]);
});

Deno.test("mockFetch() stubs fetch", async (t) => {
  using _fetch = mockFetch(t);
  const response = await fetch("https://example.com");
  assertEquals(response.status, 200);
  await assertSnapshot(t, await response.text());
});

Deno.test("mockFetch() implements spy like interface", async (t) => {
  const original = globalThis.fetch;
  const fetch = mockFetch(t);
  try {
    assert(fetch.original === original);
    const response = await fetch("https://example.com");
    assertEquals(response.status, 200);
    assertFalse(fetch.restored);
    await assertSnapshot(t, await response.text());
  } finally {
    fetch.restore();
    assert(fetch.restored);
  }
});

Deno.test("mockFetch() replays multiple calls", async (t) => {
  using fetch = mockFetch(t);
  await Promise.all([
    fetch("https://example.com"),
    fetch("https://example.com"),
    fetch("https://example.com/"), // same as the prior two
    fetch("http://example.com"),
  ]);
});

Deno.test("mockFetch() with URL", async (t) => {
  using fetch = mockFetch(t);
  if (getMockMode() === "update") await fetch("https://example.com");
  else await fetch(new URL("https://example.com"));
});

Deno.test("mockFetch() with Request", async (t) => {
  using fetch = mockFetch(t);
  if (getMockMode() === "update") await fetch("https://example.com");
  else await fetch(new Request("https://example.com"));
});

Deno.test("mockFetch() replays by method", async (t) => {
  using fetch = mockFetch(t);
  const responses = await Promise.all([
    fetch("https://example.com"), // GET
    fetch("https://example.com", { method: "GET" }),
    fetch("https://example.com", { method: "POST" }),
  ]);
  assertEquals(responses.map((r) => r.status), [200, 200, 403]);
});

Deno.test("mockFetch() checks missing mock file", async (t) => {
  using fetch = mockFetch(t);
  // never record mocks for this test
  if (getMockMode() === "update") return;
  await assertRejects(
    async () => await fetch("https://example.com"),
    MockError,
  );
});

Deno.test("mockFetch() checks call not recorded", async (t) => {
  using fetch = mockFetch(t);
  // this call be recored into mock
  await fetch("https://example.com");
  // next fetch call will not be found in mock
  if (getMockMode() === "update") return;
  await assertRejects(
    async () => await fetch("https://example.com"),
    MockError,
  );
});

Deno.test("mockFetch() checks no call made", async (t) => {
  const fetch = mockFetch(t);
  try {
    // this call be recored into mock, but not replayed
    if (getMockMode() === "update") await fetch("https://example.com");
  } finally {
    if (getMockMode() === "update") fetch.restore();
    else assertThrows(() => fetch.restore(), MockError);
  }
});

Deno.test("mockFetch() checks call not replayed", async (t) => {
  const fetch = mockFetch(t);
  try {
    await fetch("https://example.com");
    // this call be recored into mock, but not replayed
    if (getMockMode() === "update") await fetch("https://example.com");
  } finally {
    if (getMockMode() === "update") fetch.restore();
    else assertThrows(() => fetch.restore(), MockError);
  }
});
