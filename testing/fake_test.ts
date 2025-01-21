import { assert, assertEquals, assertFalse } from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import { fakeConsole, mockFetch } from "@tugrulates/testing";

Deno.test("fakeConsole() stubs console", () => {
  using mock = fakeConsole();
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

Deno.test("fakeConsole() implements spy like interface", () => {
  const console = fakeConsole();
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

Deno.test("fakeConsole() captures multiple calls", () => {
  using console = fakeConsole();
  console.debug("First!");
  console.debug("Second!");
  assertEquals(console.calls, [
    { level: "debug", data: ["First!"] },
    { level: "debug", data: ["Second!"] },
  ]);
});

Deno.test("fakeConsole() captures multiple arguments", () => {
  using console = fakeConsole();
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
