import { assertExists } from "@std/assert/exists";
import { expandGlob } from "@std/fs/expand-glob";
import { join, relative } from "@std/path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
} from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { assertSnapshot } from "@std/testing/snapshot";
import { App } from "./app.ts";
import { main } from "./cli.ts";
import { MockServer, TOKEN } from "./mock_server.ts";
import type { TestExerciseData } from "./test_data.ts";

export interface SuiteContext {
  server: MockServer;
  workspace: string;
  cachePath: string;
}

export const suite = describe<SuiteContext>("tests", function () {
  beforeAll(function (this: SuiteContext) {
    this.server = new MockServer();
  });

  afterAll(async function (this: SuiteContext) {
    await this.server.shutdown();
  });

  beforeEach(async function (this: SuiteContext) {
    this.workspace = await Deno.makeTempDir();
    this.cachePath = await Deno.makeTempFile();
  });

  afterEach(async function (this: SuiteContext) {
    this.server.reset();
    await Deno.remove(this.cachePath);
    await Deno.remove(this.workspace, { recursive: true });
  });
});

export function prune(
  s: SuiteContext,
  value: string,
  { tmp = false, port = false, hash = false } = {},
): string {
  value = value.replace(s.workspace, "WORKSPACE");
  if (tmp) {
    value = value.replace(/\/tmp\/\w+/g, "TMP");
    value = value.replace(/\/var\/folders\/.+?\/T\/\w+/g, "TMP");
  }
  if (port) value = value.replace(/(\w+):\/\/([\w.]+):\d+/g, "$1://$2:PORT");
  if (hash) value = value.replace(/[a-f0-9]{6,}/g, "HASH");
  return value;
}

export async function cli(
  s: SuiteContext,
  t: Deno.TestContext,
  args: string,
  options: {
    sorted?: boolean;
    confirm?: boolean;
    prompt?: string;
    token?: string | null;
  } = {},
): Promise<number> {
  const token = options.token ?? TOKEN;

  const captured: string[] = [];
  const capture = (level: string) => (...message: unknown[]) => {
    captured.push(
      `${level}(${
        message
          .map((m) =>
            typeof m === "string"
              ? `"${prune(s, m, { tmp: true, port: true })}"`
              : m
          )
          .join(", ")
      })`,
    );
  };
  const [debug, log, info, warn, error] = [
    stub(console, "debug", capture("debug")),
    stub(console, "log", capture("log")),
    stub(console, "info", capture("info")),
    stub(console, "warn", capture("warn")),
    stub(console, "error", capture("error")),
  ];
  const confirm = stub(globalThis, "confirm", () => options.confirm ?? false);
  const prompt = stub(globalThis, "prompt", () => options.prompt ?? null);

  using app = new App({
    endpoint: s.server.endpoint,
    token,
    workspace: s.workspace,
    cachePath: s.cachePath,
    retry: {
      minTimeout: 0,
      jitter: 0,
    },
  });
  const code = stub(
    app,
    "code",
    async (files: string[], { diff = false } = {}) => {
      capture("code")(...files, `{ diff: ${diff} }`);
      await Promise.resolve();
    },
  );
  const open = stub(app, "open", capture("open"));

  try {
    const code = await main(app, [
      // ...(token ? [`--token=${token}`] : []),
      ...args.split(" ").filter((arg) => arg),
    ]);
    if (options.sorted) captured.sort();
    await assertSnapshot(t, captured);
    return code;
  } finally {
    debug.restore();
    log.restore();
    info.restore();
    warn.restore();
    error.restore();
    confirm.restore();
    prompt.restore();
    open.restore();
    code.restore();
  }
}

export async function assertFiles(
  s: SuiteContext,
  t: Deno.TestContext,
  target: string | TestExerciseData,
): Promise<void> {
  if (typeof target !== "string") {
    assertExists(target.track.slug);
    assertExists(target.exercise.slug);
    const dir = join(
      s.workspace,
      target.track.slug,
      target.exercise.slug,
    );
    return await assertFiles(s, t, dir);
  }
  const files = await findFiles(target);
  const contents = await Promise.all(
    files.map(async (file) => ({
      filename: relative(target, file),
      content: prune(s, await Deno.readTextFile(file), { port: true }),
    })),
  );
  await assertSnapshot(t, contents);
}

async function findFiles(directory: string): Promise<string[]> {
  const files = [];
  const glob = expandGlob("*", { root: directory, exclude: [".*"] });
  for await (const found of glob) {
    if (found.isDirectory) files.push(...await findFiles(found.path));
    else files.push(found.path);
  }
  return files;
}
