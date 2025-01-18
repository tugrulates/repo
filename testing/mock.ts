import { basename, dirname, fromFileUrl, join } from "@std/path";
import { type Stub, stub } from "@std/testing/mock";

const MOCKS = "__mocks__";

class MockManager {
  static instance = new MockManager();
  private paths = new Map<string, Map<string, object[]>>();

  private constructor() {
    addEventListener("unload", async () => {
      await this.close();
    });
  }

  addCall(t: Deno.TestContext, name: string, result: object) {
    const path = MockManager.testPath(t);
    if (!this.paths.has(path)) this.paths.set(path, new Map());
    const test = this.paths.get(path);
    const key = MockManager.testKey(t, name);
    if (!test?.has(key)) test?.set(key, []);
    test?.get(key)?.push(result);
  }

  async getCalls<T>(t: Deno.TestContext, name: string) {
    const path = MockManager.testPath(t);
    const key = MockManager.testKey(t, name);
    const { mock } = await import(path);
    return (mock[key] ?? []) as T[];
  }

  private static testPath(context: Deno.TestContext) {
    return join(
      dirname(fromFileUrl(context.origin)),
      MOCKS,
      `${basename(context.origin)}.mock`,
    );
  }

  private static testKey(context: Deno.TestContext, name: string) {
    const breadcrumb = [context.name, name];
    while (context.parent) {
      breadcrumb.unshift(context.parent.name);
      context = context.parent;
    }
    return breadcrumb.join(" > ");
  }

  private async close() {
    if (!isUpdating()) return;
    for (const [path, test] of this.paths) {
      const contents = [`export const mock = {}`];
      for (const [key, calls] of test) {
        const json = JSON.stringify(calls, undefined, 2);
        contents.push(`mock[\`${key}\`] = \n${json}\n`);
      }
      await Deno.mkdir(dirname(path), { recursive: true });
      await Deno.writeTextFile(path, contents.join("\n\n"));
    }
  }
}

function isUpdating() {
  return Deno.args.includes("--update");
}

interface FetchCall {
  request: {
    input: string;
    init?: RequestInit | undefined;
  };
  response: {
    body: string;
    status: number;
    statusText: string;
    headers: [string, string][];
  };
}

/**
 * Return type of the {@linkcode mockFetch} function.
 */
export class MockFetch {
  private stub: Stub<
    typeof globalThis,
    [input: string | URL | Request, init?: RequestInit | undefined],
    Promise<Response>
  >;
  private calls: FetchCall[] | undefined = undefined;

  /** Create a new MockFetch, to override calls to the global `fetch` function. */
  constructor(private t: Deno.TestContext) {
    this.stub = stub(
      globalThis,
      "fetch",
      (input: URL | Request | string, init?: RequestInit) =>
        this.call(input, init),
    );
  }

  /** Either spy on or delegate global `fetch`, depending on whether `--update` flag. */
  private async call(
    input: URL | Request | string,
    init?: RequestInit,
  ): Promise<Response> {
    let call: FetchCall;
    if (isUpdating()) {
      const response = await this.stub.original.call(globalThis, input, init);
      call = {
        request: {
          input: input.toString(),
          init,
        },
        response: {
          body: await response.text(),
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
        },
      };
      MockManager.instance.addCall(this.t, "fetch", call);
    } else {
      if (!this.calls) {
        this.calls = await MockManager.instance.getCalls<FetchCall>(
          this.t,
          "fetch",
        );
      }
      const found = this.calls?.find((call) =>
        call.request.input === input.toString()
      );
      if (found === undefined) throw new Error("No matching fetch call found");
      this.calls.splice(this.calls.indexOf(found), 1);
      call = found;
    }
    return new Response(call.response.body, {
      status: call.response.status,
      statusText: call.response.statusText,
      headers: new Headers(call.response.headers),
    });
  }

  /** Restore global `fetch` to its original value. */
  restore() {
    if (!isUpdating()) {
      if (this.calls === undefined) throw new Error("No fetch calls recorded");
      if (this.calls.length > 0) throw new Error("Unmatched fetch calls");
    }
    this.stub.restore();
  }

  /** Dispose of the mock, and restore global `fetch`. */
  [Symbol.dispose]() {
    this.restore();
  }
}

/**
 * Create a mock for the global `fetch` function.
 *
 * Usage is {@link ../../std/testing/doc/snapshot/~ | @std/testing/snapshot}
 * style. Running tests with `--update` flag will create a mock file in the
 * `__mocks__` directory, using real fetch calls. The mock file will be used
 * in subsequent test runs, when the `--update` flag is not present.
 *
 * When running tests with the mock, responses will be returned from matching
 * requests with URL and method. If no matching request is found, an error
 * will be thrown. If at the end of the test, there are still unhandled calls,
 * an error will be thrown.
 *
 * @example
 * ```ts
 * import { mockFetch } from "@tugrulates/testing";
 * import { assertEquals } from "@std/assert";
 *
 * Deno.test("mockFetch", async (t) => {
 *  using _fetch = mockFetch(t);
 *  const response = await fetch("https://example.com");
 *  assertEquals(response.status, 200);
 * });
 * ```
 *
 * When using the mock, the `--allow-read` permission must be enabled, or else
 * any calls to `fetch` will fail due to insufficient permissions. Additionally,
 * when updating the mock, the `--allow-write` and `--allow-net` permissions
 * must be enabled.
 *
 * The mock file that is created under the `__mocks__` directory needs to be
 * committed to version control. This allows for tests not needing to rely on
 * actual network calls, and the changes in mock behavior to be peer-reviewed.
 *
 * @todo Match calls by method in addition to URL.
 *
 * @param context The test context.
 * @returns The mock fetch instance.
 */
export function mockFetch(context: Deno.TestContext): MockFetch {
  return new MockFetch(context);
}
