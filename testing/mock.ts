import { basename, dirname, fromFileUrl, join } from "@std/path";
import { MockError, stub } from "@std/testing/mock";

const MOCKS = "__mocks__";

export { MockError } from "@std/testing/mock";

/** The mode of mock. */
export type MockMode = "replay" | "update";

/**
 * Get the mode of the mocking system. Defaults to `replay`, unless the `-u`
 * or `--update` flag is passed, in which case this will be set to `update`.
 */
export function getMockMode(): MockMode {
  return Deno.args.some((arg) => arg === "--update" || arg === "-u")
    ? "update"
    : "replay";
}

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
    if (getMockMode() === "replay") return;

    for (const [path, test] of this.paths) {
      const contents = [`export const mock = {}`];
      for (const [key, calls] of test) {
        const serialized = Deno.inspect(calls, {
          breakLength: Infinity,
          compact: false,
          depth: Infinity,
          iterableLimit: Infinity,
          sorted: true,
          strAbbreviateSize: Infinity,
          trailingComma: true,
        }).replaceAll("\r", "\\r");
        contents.push(`mock[\`${key}\`] = \n${serialized}\n`);
      }
      await Deno.mkdir(dirname(path), { recursive: true });
      await Deno.writeTextFile(path, contents.join("\n\n"));
    }
  }
}

interface FetchRequest {
  input: string | URL | Request;
  init?: RequestInit | undefined;
}

interface FetchResponse {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
}

interface FetchCall {
  request: FetchRequest;
  response: FetchResponse;
}

/** A mock that can replay recorded calls. */
export interface Mock<Args extends unknown[], Return> extends Disposable {
  (...args: Args): Return;
  /** The function that is mocked. */
  original: (...args: Args) => Return;
  /** Whether or not the original instance method has been restored. */
  restored: boolean;
  /** If mocking an instance method, this restores the original instance method. */
  restore(): void;
}

function getFetchRequestSignature(request: FetchRequest): string {
  if (request.input instanceof Request) {
    return getFetchRequestSignature({
      input: new URL(request.input.url),
      init: { method: request.init?.method ?? request.input.method },
    });
  }
  if (typeof request.input === "string") {
    return getFetchRequestSignature({
      input: new URL(request.input),
      init: request.init,
    });
  }
  return `${request.input.toString()} ${request.init?.method ?? "GET"}`;
}

/**
 * Create a mock for the global `fetch` function.
 *
 * Usage is {@link ../../std/testing/doc/snapshot/~ | @std/testing/snapshot}
 * style. Running tests with `--update` or `-u` flag will create a mock file
 * in the `__mocks__` directory, using real fetch calls. The mock file will
 * be used in subsequent test runs, when the these flags are not present.
 *
 * When running tests with the mock, responses will be returned from matching
 * requests with URL and method. If no matching request is found, or, If at the
 * end of the test, there are still unhandled calls, a {@link MockError} will
 * be thrown.
 *
 * @example
 * ```ts
 * import { mockFetch } from "@tugrulates/testing";
 * import { assertEquals } from "@std/assert";
 *
 * Deno.test("mockFetch", async (t) => {
 *  using fetch = mockFetch(t);
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
 * @param context The test context.
 * @returns The mock fetch instance.
 */
export function mockFetch(context: Deno.TestContext): Mock<
  [input: string | URL | Request, init?: RequestInit | undefined],
  Promise<Response>
> {
  let calls: FetchCall[] | undefined = undefined;
  const mock = async function (
    input: URL | Request | string,
    init?: RequestInit,
  ) {
    let call: FetchCall;
    if (getMockMode() === "update") {
      const response = await spy.original.call(globalThis, input, init);
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
      MockManager.instance.addCall(context, "fetch", call);
    } else {
      if (!calls) {
        calls = await MockManager.instance.getCalls<FetchCall>(
          context,
          "fetch",
        );
      }
      const signature = getFetchRequestSignature({ input, init });
      console.log(signature);
      const found = calls?.find((call) =>
        getFetchRequestSignature(call.request) === signature
      );
      if (found === undefined) {
        throw new MockError(`No matching fetch call found: ${signature}`);
      }
      calls.splice(calls.indexOf(found), 1);
      call = found;
    }
    return new Response(call.response.body, {
      status: call.response.status,
      statusText: call.response.statusText,
      headers: new Headers(call.response.headers),
    });
  } as Mock<
    [input: string | URL | Request, init?: RequestInit | undefined],
    Promise<Response>
  >;
  const spy = stub(globalThis, "fetch", mock);
  Object.defineProperties(mock, {
    original: {
      enumerable: true,
      value: spy.original,
    },
    restored: {
      enumerable: true,
      get: () => spy.restored,
    },
    restore: {
      enumerable: true,
      value: () => {
        spy.restore();
        if (getMockMode() === "replay") {
          if (calls === undefined) {
            throw new MockError("No fetch calls made");
          }
          if (calls.length > 0) {
            throw new MockError(
              "Unmatched fetch calls: " +
                calls.map((c) => getFetchRequestSignature(c.request)),
            );
          }
        }
      },
    },
    [Symbol.dispose]: {
      value: () => {
        mock.restore();
      },
    },
  });
  return mock;
}
