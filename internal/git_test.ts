import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { omit } from "@std/collections/omit";
import {
  gitAddRemote,
  gitCheckout,
  gitClone,
  gitCommit,
  gitCurrentBranch,
  gitInit,
  gitListTags,
  gitLog,
  gitPull,
  gitPushCommits,
  gitPushTag,
  gitRemoteBase,
  gitRemoteUrl,
  gitTag,
} from "@tugrulates/internal/git";
import { tempDir } from "@tugrulates/testing";

const USER = { name: "A U Thor", email: "author@example.com" };

Deno.test("Commit can be simple", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({
    dir: repo.path,
    message: "message\n\nbody",
  });
  assertExists(commit.hash);
  assertEquals(omit(commit, ["hash"]), {
    author: `${USER.name} <${USER.email}>`,
    title: "message",
    body: "body",
    type: undefined,
    modules: [],
    breaking: false,
  });
});

Deno.test("Commit can be conventional", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({
    dir: repo.path,
    message: "feat(module): message",
  });
  assertExists(commit.hash);
  assertEquals(omit(commit, ["hash"]), {
    author: `${USER.name} <${USER.email}>`,
    title: "feat(module): message",
    body: "",
    type: "feat",
    modules: ["module"],
    breaking: false,
  });
});

Deno.test("Commit can be conventional and have body", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({
    dir: repo.path,
    message: "feat(module): message\n\nbody",
  });
  assertExists(commit.hash);
  assertEquals(omit(commit, ["hash"]), {
    author: `${USER.name} <${USER.email}>`,
    title: "feat(module): message",
    body: "body",
    type: "feat",
    modules: ["module"],
    breaking: false,
  });
});

Deno.test("Commit can be breaking", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({
    dir: repo.path,
    message: "feat(module)!: message",
  });
  assertExists(commit.hash);
  assertEquals(omit(commit, ["hash"]), {
    author: `${USER.name} <${USER.email}>`,
    title: "feat(module)!: message",
    body: "",
    type: "feat",
    modules: ["module"],
    breaking: true,
  });
});

Deno.test("Commit can be breaking and not have a module", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({
    dir: repo.path,
    message: "feat!: message",
  });
  assertExists(commit.hash);
  assertEquals(omit(commit, ["hash"]), {
    author: `${USER.name} <${USER.email}>`,
    title: "feat!: message",
    body: "",
    type: "feat",
    modules: [],
    breaking: true,
  });
});

Deno.test("Commit can have multiple modules", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({
    dir: repo.path,
    message: "feat(module1, module2): message",
  });
  assertExists(commit.hash);
  assertEquals(omit(commit, ["hash"]), {
    author: `${USER.name} <${USER.email}>`,
    title: "feat(module1, module2): message",
    body: "",
    type: "feat",
    modules: ["module1", "module2"],
    breaking: false,
  });
});

Deno.test("gitInit() creates a repo", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path });
  assert((await Deno.stat(`${repo.path}/.git`)).isDirectory);
});

Deno.test("gitInit() creates a repo with a user", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({ dir: repo.path, message: "message" });
  assertEquals(commit?.author, `${USER.name} <${USER.email}>`);
});

Deno.test("gitCheckout() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitCheckout({ dir: repo.path }));
});

Deno.test("gitCheckout() stays at current branch", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "message" });
  const branch = await gitCurrentBranch({ dir: repo.path });
  await gitCheckout({ dir: repo.path });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), branch);
});

Deno.test("gitCheckout() switches to branch", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const main = await gitCurrentBranch({ dir: repo.path });
  assertExists(main);

  const commit1 = await gitCommit({ dir: repo.path, message: "first" });
  await gitCheckout({ dir: repo.path, newBranch: "branch" });
  const commit2 = await gitCommit({ dir: repo.path, message: "second" });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), "branch");
  assertEquals(await gitLog({ dir: repo.path }), [commit2, commit1]);

  await gitCheckout({ dir: repo.path, commit: main });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), main);
  assertEquals(await gitLog({ dir: repo.path }), [commit1]);

  await gitCheckout({ dir: repo.path, commit: "branch" });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), "branch");
  assertEquals(await gitLog({ dir: repo.path }), [commit2, commit1]);
});

Deno.test("gitCheckout() switches to commit", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const main = await gitCurrentBranch({ dir: repo.path });
  assertExists(main);

  const commit1 = await gitCommit({ dir: repo.path, message: "first" });
  await gitCheckout({ dir: repo.path, commit: commit1 });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), undefined);
  assertEquals(await gitLog({ dir: repo.path }), [commit1]);

  await gitCheckout({ dir: repo.path, newBranch: "branch" });
  const commit2 = await gitCommit({ dir: repo.path, message: "second" });
  await gitCheckout({ dir: repo.path, commit: commit1 });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), undefined);
  assertEquals(await gitLog({ dir: repo.path }), [commit1]);

  await gitCheckout({ dir: repo.path, commit: commit2 });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), undefined);
  assertEquals(await gitLog({ dir: repo.path }), [commit2, commit1]);
});

Deno.test("gitCurrentBranch() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitCurrentBranch({ dir: repo.path }));
});

Deno.test("gitCurrentBranch() returns current branch", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "message" });
  await gitCheckout({ dir: repo.path, newBranch: "branch" });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), "branch");
});

Deno.test("gitCurrentBranch() returns undefined on detached state", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({ dir: repo.path, message: "first" });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitCheckout({ dir: repo.path, commit });
  assertEquals(await gitCurrentBranch({ dir: repo.path }), undefined);
});

Deno.test("gitCommit() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitCommit({ dir: repo.path, message: "message" }));
});

Deno.test("gitCommit() creates empty commit", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({ dir: repo.path, message: "message" });
  assertEquals(commit?.title, "message");
});

Deno.test("gitCommit() adds files", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  const commit = await gitCommit({
    dir: repo.path,
    message: "message",
    add: ["file"],
  });
  assertEquals(commit?.title, "message");
});

Deno.test("gitCommit() removes files", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file"],
  });
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    remove: ["file"],
  });
  assertEquals(commit1?.title, "first");
  assertEquals(commit2?.title, "second");
  await assertRejects(() => Deno.stat(`${repo.path}/file`));
});

Deno.test("gitCommit() fails to add non-existent file", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path });
  await assertRejects(() =>
    gitCommit({ dir: repo.path, message: "message", add: ["file"] })
  );
});

Deno.test("gitCommit() fails to remove non-existent file", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path });
  await assertRejects(() =>
    gitCommit({ dir: repo.path, message: "message", remove: ["file"] })
  );
});

Deno.test("gitLog() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitLog({ dir: repo.path }));
});

Deno.test("gitLog() fails on empty repo", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path });
  await assertRejects(() => gitLog({ dir: repo.path }));
});

Deno.test("gitLog() returns single commit", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file`, "content");
  const commit = await gitCommit({
    dir: repo.path,
    message: "message\n\nbody",
    add: ["file"],
  });
  assertEquals(await gitLog({ dir: repo.path }), [commit]);
});

Deno.test("gitLog() returns multiple commits", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content");
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    add: ["file2"],
  });
  assertEquals(await gitLog({ dir: repo.path }), [commit2, commit1]);
});

Deno.test("gitLog() returns file changes", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content");
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    add: ["file2"],
  });
  assertEquals(await gitLog({ dir: repo.path, path: "file1" }), [
    commit1,
  ]);
  assertEquals(await gitLog({ dir: repo.path, path: "file2" }), [
    commit2,
  ]);
});

Deno.test("gitLog() returns blame", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    add: ["file2"],
  });
  assertEquals(await gitLog({ dir: repo.path, line: "content1" }), [
    commit1,
  ]);
  assertEquals(await gitLog({ dir: repo.path, line: "content2" }), [
    commit2,
  ]);
});

Deno.test("gitLog() returns blame from multiple files", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    add: ["file2"],
  });
  assertEquals(await gitLog({ dir: repo.path, line: "content" }), [
    commit2,
    commit1,
  ]);
});

Deno.test("gitLog() returns blame from specific file", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    add: ["file2"],
  });
  assertEquals(
    await gitLog({ dir: repo.path, path: "file1", line: "content" }),
    [commit1],
  );
  assertEquals(
    await gitLog({ dir: repo.path, path: "file2", line: "content" }),
    [commit2],
  );
});

Deno.test("gitLog() returns range commits", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  const commit1 = await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  const commit2 = await gitCommit({
    dir: repo.path,
    message: "second",
    add: ["file2"],
  });
  assertEquals(await gitLog({ dir: repo.path, from: commit1 }), [
    commit2,
  ]);
});

Deno.test("gitLog() filters by author", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await Deno.writeTextFile(`${repo.path}/file1`, "content1");
  const commit1 = await gitCommit({
    dir: repo.path,
    author: "author1 <author1@example.com>",
    message: "first",
    add: ["file1"],
  });
  await Deno.writeTextFile(`${repo.path}/file2`, "content2");
  const commit2 = await gitCommit({
    dir: repo.path,
    author: "author2 <author2@example.com>",
    message: "second",
    add: ["file2"],
  });
  assertEquals(await gitLog({ dir: repo.path, author: "author1" }), [
    commit1,
  ]);
  assertEquals(
    await gitLog({ dir: repo.path, author: "author1@example.com" }),
    [commit1],
  );
  assertEquals(await gitLog({ dir: repo.path, author: "author2" }), [
    commit2,
  ]);
  assertEquals(
    await gitLog({ dir: repo.path, author: "author2@example.com" }),
    [commit2],
  );
});

Deno.test("gitTag() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitTag("v1.0.0", { dir: repo.path }));
});

Deno.test("gitTag() creates a tag", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  const tags = await gitListTags({ dir: repo.path });
  assertEquals(tags, ["v1.0.0"]);
});

Deno.test("gitTag() creates a tag with message", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path, message: "message" });
  const tags = await gitListTags({ dir: repo.path });
  assertEquals(tags, ["v1.0.0"]);
});

Deno.test("gitTag() creates a tag with commit", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  const commit = await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path, commit });
  const tags = await gitListTags({ dir: repo.path });
  assertEquals(tags, ["v1.0.0"]);
});

Deno.test("gitTag() creates a tag with another tag", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  await gitTag("v1.0.1", { dir: repo.path, commit: "v1.0.0" });
  const tags = await gitListTags({ dir: repo.path });
  assertEquals(tags, ["v1.0.0", "v1.0.1"]);
});

Deno.test("gitTag() fails to create duplicate tag", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  await assertRejects(() => gitTag("v1.0.0", { dir: repo.path }));
});

Deno.test("gitListTags() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitListTags({ dir: repo.path }));
});

Deno.test("gitListTags() return empty list on empty repo", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  assertEquals(await gitListTags({ dir: repo.path }), []);
});

Deno.test("gitListTags() return empty list on no tags repo", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  assertEquals(await gitListTags({ dir: repo.path }), []);
});

Deno.test("gitListTags() returns single tag", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  assertEquals(await gitListTags({ dir: repo.path }), ["v1.0.0"]);
});

Deno.test("gitListTags() returns multiple tags with version sort", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  await gitCommit({ dir: repo.path, message: "second" });
  await gitTag("v2.0.0", { dir: repo.path });
  assertEquals(await gitListTags({ dir: repo.path, sort: "version" }), [
    "v2.0.0",
    "v1.0.0",
  ]);
});

Deno.test("gitListTags() matches tag name", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  await gitTag("v2.0.0", { dir: repo.path });
  assertEquals(await gitListTags({ dir: repo.path, name: "v2.0.0" }), [
    "v2.0.0",
  ]);
});

Deno.test("gitListTags() matches tag pattern", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "first" });
  await gitTag("v1.0.0", { dir: repo.path });
  await gitTag("v2.0.0", { dir: repo.path });
  assertEquals(await gitListTags({ dir: repo.path, name: "v2*" }), [
    "v2.0.0",
  ]);
});

Deno.test("gitClone() clones a repo", async () => {
  await using remote = await tempDir();
  await gitInit({ dir: remote.path, user: USER });
  const commit = await gitCommit({ dir: remote.path, message: "message" });

  await using repo = await tempDir();
  await gitClone(remote.path, { dir: repo.path, user: USER });
  assertEquals(await gitRemoteUrl({ dir: repo.path }), remote.path);

  const [pull] = await gitLog({ dir: repo.path });
  assertEquals(pull, commit);
});

Deno.test("gitAddRemoteUrl() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitAddRemote("url", { dir: repo.path }));
});

Deno.test("gitAddRemoteUrl() add remote URL", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitAddRemote("url", { dir: repo.path });
  assertEquals(await gitRemoteUrl({ dir: repo.path }), "url");
});

Deno.test("gitRemoteUrl() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitRemoteUrl({ dir: repo.path }));
});

Deno.test("gitRemoteUrl() returns remote URL", async () => {
  await using repo = await tempDir();
  await gitInit({ dir: repo.path, user: USER });
  await gitAddRemote("url", { dir: repo.path, remote: "downstream" });
  assertEquals(
    await gitRemoteUrl({ dir: repo.path, remote: "downstream" }),
    "url",
  );
});

Deno.test("gitRemoteHead() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitRemoteBase({ dir: repo.path }));
});

Deno.test("gitRemoteHead() returns remote head branch", async () => {
  await using remote = await tempDir();
  await gitInit({ dir: remote.path, bare: true, user: USER });
  const head = await gitCurrentBranch({ dir: remote.path });

  await using repo = await tempDir();
  await gitClone(remote.path, { dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "initial" });
  await gitPushCommits({ dir: repo.path });

  assertEquals(await gitRemoteBase({ dir: repo.path }), head);
});

Deno.test("gitPushCommits() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitPushCommits({ dir: repo.path }));
});

Deno.test("gitPushCommits() pushes commits to remote", async () => {
  await using remote = await tempDir();
  await gitInit({ dir: remote.path, bare: true, user: USER });

  await using repo = await tempDir();
  await gitClone(remote.path, { dir: repo.path, user: USER });
  const commit1 = await gitCommit({ dir: repo.path, message: "second" });
  const commit2 = await gitCommit({ dir: repo.path, message: "third" });
  await gitPushCommits({ dir: repo.path });

  assertEquals(await gitLog({ dir: remote.path }), [commit2, commit1]);
});

Deno.test("gitPushTag() fails on non-repo", async () => {
  await using repo = await tempDir();
  await assertRejects(() => gitPushTag("tag", { dir: repo.path }));
});

Deno.test("gitPushTags() pushes tags to remote", async () => {
  await using remote = await tempDir();
  await gitInit({ dir: remote.path, bare: true, user: USER });

  await using repo = await tempDir();
  await gitClone(remote.path, { dir: repo.path, user: USER });
  await gitCommit({ dir: repo.path, message: "initial" });
  await gitTag("v1.0.0", { dir: repo.path });
  await gitPushCommits({ dir: repo.path });
  await gitPushTag("v1.0.0", { dir: repo.path });

  assertEquals(await gitListTags({ dir: remote.path }), ["v1.0.0"]);
});

Deno.test("gitPull() pulls commits ands tags", async () => {
  await using remote = await tempDir();
  await gitInit({ dir: remote.path, bare: true, user: USER });

  await using repo = await tempDir();
  await gitClone(remote.path, { dir: repo.path, user: USER });

  await using other = await tempDir();
  await gitClone(remote.path, { dir: other.path, user: USER });
  const commit = await gitCommit({ dir: other.path, message: "initial" });
  await gitTag("v1.0.0", { dir: other.path });
  await gitPushCommits({ dir: other.path });
  await gitPushTag("v1.0.0", { dir: other.path });

  await gitPull({ dir: repo.path });
  assertEquals(await gitLog({ dir: repo.path }), [commit]);
  assertEquals(await gitListTags({ dir: repo.path }), ["v1.0.0"]);
});
