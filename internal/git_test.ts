import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { omit } from "@std/collections";
import {
  gitCommit,
  gitInit,
  gitListTags,
  gitLog,
  gitTag,
} from "@tugrulates/internal/git";
import { tempDir } from "@tugrulates/testing";

Deno.test("gitInit() creates a repo", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  assert((await Deno.stat(`${repo.path}/.git`)).isDirectory);
});

Deno.test("gitCommit() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitCommit({ repo: repo.path, message: "message" }));
});

Deno.test("gitCommit() creates empty commit", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  const commit = await gitCommit({ repo: repo.path, message: "message" });
  assertEquals(commit?.title, "message");
});

Deno.test("gitCommit() adds files", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  const commit = await gitCommit({
    repo: repo.path,
    message: "message",
    add: ["file"],
  });
  assertEquals(commit?.title, "message");
});

Deno.test("gitCommit() removes files", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  const commit1 = await gitCommit({
    repo: repo.path,
    message: "first",
    add: ["file"],
  });
  const commit2 = await gitCommit({
    repo: repo.path,
    message: "second",
    remove: ["file"],
  });
  assertEquals(commit1?.title, "first");
  assertEquals(commit2?.title, "second");
  await assertRejects(() => Deno.stat(`${repo.path}/file`));
});

Deno.test("gitCommit() fails to add non-existent file", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await assertRejects(() =>
    gitCommit({ repo: repo.path, message: "message", add: ["file"] })
  );
});

Deno.test("gitCommit() fails to remove non-existent file", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await assertRejects(() =>
    gitCommit({ repo: repo.path, message: "message", remove: ["file"] })
  );
});

Deno.test("gitLog() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitLog({ repo: repo.path }));
});

Deno.test("gitLog() fails on empty repo", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await assertRejects(() => gitLog({ repo: repo.path }));
});

Deno.test("gitLog() returns simple commit", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  await gitCommit({ repo: repo.path, message: "message", add: ["file"] });

  const log = await gitLog({ repo: repo.path });

  assertEquals(log.length, 1);
  const [commit] = log;
  assertExists(commit?.hash);
  assertEquals(omit(commit, ["hash"]), {
    title: "message",
    type: undefined,
    modules: [],
    breaking: false,
  });
});

Deno.test("gitLog() returns conventional commit", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  await gitCommit({
    repo: repo.path,
    message: "feat(module): message",
    add: ["file"],
  });

  const [commit] = await gitLog({ repo: repo.path });

  assertExists(commit?.hash);
  assertEquals(omit(commit, ["hash"]), {
    title: "feat(module): message",
    type: "feat",
    modules: ["module"],
    breaking: false,
  });
});

Deno.test("gitLog() returns breaking commit", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  await gitCommit({
    repo: repo.path,
    message: "feat(module)!: message",
    add: ["file"],
  });

  const [commit] = await gitLog({ repo: repo.path });

  assertExists(commit?.hash);
  assertEquals(omit(commit, ["hash"]), {
    title: "feat(module)!: message",
    type: "feat",
    modules: ["module"],
    breaking: true,
  });
});

Deno.test("gitLog() returns non-module breaking commit", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  await gitCommit({
    repo: repo.path,
    message: "feat!: message",
    add: ["file"],
  });

  const [commit] = await gitLog({ repo: repo.path });

  assertExists(commit?.hash);
  assertEquals(omit(commit, ["hash"]), {
    title: "feat!: message",
    type: "feat",
    modules: [],
    breaking: true,
  });
});

Deno.test("gitLog() returns multiple-module commit", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  await gitCommit({
    repo: repo.path,
    message: "feat(module1, module2): message",
    add: ["file"],
  });

  const [commit] = await gitLog({ repo: repo.path });

  assertExists(commit?.hash);
  assertEquals(omit(commit, ["hash"]), {
    title: "feat(module1, module2): message",
    type: "feat",
    modules: ["module1", "module2"],
    breaking: false,
  });
});

Deno.test("gitLog() returns multiple commits", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file1`, "content");
  await gitCommit({ repo: repo.path, message: "first", add: ["file1"] });
  await Deno.writeTextFile(`${repo.path}/file2`, "content");
  await gitCommit({ repo: repo.path, message: "second", add: ["file2"] });

  const log = await gitLog({ repo: repo.path });

  assertEquals(log.length, 2);
  const [commit2, commit1] = log;
  assertEquals(commit1?.title, "first");
  assertEquals(commit2?.title, "second");
});

Deno.test("gitLog() returns file changes", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file1`, "content");
  await gitCommit({ repo: repo.path, message: "first", add: ["file1"] });
  await Deno.writeTextFile(`${repo.path}/file2`, "content");
  await gitCommit({ repo: repo.path, message: "second", add: ["file2"] });

  const log = await gitLog({ repo: repo.path, path: "file1" });

  assertEquals(log.length, 1);
  const [commit] = log;
  assertEquals(commit?.title, "first");
});

Deno.test("gitLog() returns blame", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  await gitCommit({ repo: repo.path, message: "first", add: ["file1"] });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  await gitCommit({ repo: repo.path, message: "second", add: ["file2"] });

  const log = await gitLog({ repo: repo.path, line: "content1" });

  assertEquals(log.length, 1);
  const [commit] = log;
  assertEquals(commit?.title, "first");
});

Deno.test("gitLog() returns blame from multiple files", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  await gitCommit({ repo: repo.path, message: "first", add: ["file1"] });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  await gitCommit({ repo: repo.path, message: "second", add: ["file2"] });

  const log = await gitLog({ repo: repo.path, line: "content" });

  assertEquals(log.length, 2);
  const [commit2, commit1] = log;
  assertEquals(commit1?.title, "first");
  assertEquals(commit2?.title, "second");
});

Deno.test("gitLog() returns blame from specific file", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  await gitCommit({ repo: repo.path, message: "first", add: ["file1"] });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  await gitCommit({ repo: repo.path, message: "second", add: ["file2"] });

  const log = await gitLog({ repo: repo.path, path: "file1", line: "content" });
  assertEquals(log.length, 1);
  const [commit] = log;
  assertEquals(commit?.title, "first");
});

Deno.test("gitLog() returns range commits", async () => {
  await using repo = await tempDir();

  await gitInit({ repo: repo.path });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  await gitCommit({ repo: repo.path, message: "first", add: ["file1"] });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  await gitCommit({ repo: repo.path, message: "second", add: ["file2"] });

  const allLog = await gitLog({ repo: repo.path });
  const [commit2, commit1] = allLog;
  assertExists(commit1);
  const log = await gitLog({ repo: repo.path, from: commit1 });

  assertEquals(log.length, 1);
  const [commit] = log;
  assertEquals(commit, commit2);
});

Deno.test("gitTag() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitTag("v1.0.0", { repo: repo.path }));
});

Deno.test("gitTag() creates a tag", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  const tags = await gitListTags({ repo: repo.path });
  assertEquals(tags, ["v1.0.0"]);
});

Deno.test("gitTag() creates a tag with message", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path, message: "message" });
  const tags = await gitListTags({ repo: repo.path });
  assertEquals(tags, ["v1.0.0"]);
});

Deno.test("gitTag() creates a tag with commit", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  const commit = await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path, commit });
  const tags = await gitListTags({ repo: repo.path });
  assertEquals(tags, ["v1.0.0"]);
});

Deno.test("gitTag() creates a tag with another tag", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  await gitTag("v1.0.1", { repo: repo.path, commit: "v1.0.0" });
  const tags = await gitListTags({ repo: repo.path });
  assertEquals(tags, ["v1.0.0", "v1.0.1"]);
});

Deno.test("gitTag() fails to create duplicate tag", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  await assertRejects(() => gitTag("v1.0.0", { repo: repo.path }));
});

Deno.test("gitListTags() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitListTags({ repo: repo.path }));
});

Deno.test("gitListTags() return empty list on empty repo", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  assertEquals(await gitListTags({ repo: repo.path }), []);
});

Deno.test("gitListTags() return empty list on no tags repo", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  assertEquals(await gitListTags({ repo: repo.path }), []);
});

Deno.test("gitListTags() returns single tag", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  assertEquals(await gitListTags({ repo: repo.path }), ["v1.0.0"]);
});

Deno.test("gitListTags() returns multiple tags", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  await gitCommit({ repo: repo.path, message: "second" });
  await gitTag("v2.0.0", { repo: repo.path });
  assertEquals(await gitListTags({ repo: repo.path }), ["v1.0.0", "v2.0.0"]);
});

Deno.test("gitListTags() matches tag name", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  await gitTag("v2.0.0", { repo: repo.path });
  assertEquals(await gitListTags({ repo: repo.path, name: "v2.0.0" }), [
    "v2.0.0",
  ]);
});

Deno.test("gitListTags() matches tag pattern", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await gitCommit({ repo: repo.path, message: "first" });
  await gitTag("v1.0.0", { repo: repo.path });
  await gitTag("v2.0.0", { repo: repo.path });
  assertEquals(await gitListTags({ repo: repo.path, name: "v2*" }), ["v2.0.0"]);
});
