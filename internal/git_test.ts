import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import {
  conventional,
  type Git,
  type GitCommit,
  gitRepo,
} from "@tugrulates/internal/git";
import { tempDir } from "@tugrulates/testing";

async function tempRepo(
  { bare, clone }: { bare?: boolean; clone?: Git } = {},
): Promise<Git & AsyncDisposable> {
  const repo = gitRepo({ directory: await Deno.makeTempDir() });
  Object.assign(repo, {
    [Symbol.asyncDispose]: () =>
      Deno.remove(repo.directory, { recursive: true }),
  });

  const config = {
    user: { name: "A U Thor", email: "author@example.com" },
    commit: { gpgsign: false },
    tag: { gpgsign: false },
  };
  bare ??= false;
  if (clone) await repo.clone(clone.directory, { config, bare });
  await repo.init({ config, bare });
  return repo as Git & AsyncDisposable;
}

function testCommit(summary: string): GitCommit {
  return {
    hash: "hash",
    author: { name: "author-name", email: "author-email" },
    committer: { name: "committer-name", email: "committer-email" },
    summary: summary,
    body: "body",
  };
}

Deno.test("Git.config() configures user", async () => {
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.init();
  await repo.config({ user: { name: "name", email: "email" } });
  const commit = await repo.commit("summary", {
    sign: false,
    allowEmpty: true,
  });
  assertEquals(commit?.author, { name: "name", email: "email" });
});

Deno.test("Git.init() creates a repo", async () => {
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.init();
  assert((await Deno.stat(repo.path(".git"))).isDirectory);
});

Deno.test("Git.init() creates a repo with initial branch", async () => {
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.init({ branch: "initial" });
  assertEquals(await repo.branch(), "initial");
  await repo.init();
});

Deno.test("Git.init() configures repo", async () => {
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.init({ config: { user: { name: "name", email: "email" } } });
  const commit = await repo.commit("summary", {
    sign: false,
    allowEmpty: true,
  });
  assertEquals(commit?.author, { name: "name", email: "email" });
});

Deno.test("Git.clone() clones a repo", async () => {
  await using remote = await tempRepo();
  await remote.commit("first", { allowEmpty: true });
  await remote.commit("second", { allowEmpty: true });
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.clone(remote.directory);
  assertEquals(await repo.remote(), remote.directory);
  assertEquals(await repo.log(), await remote.log());
});

Deno.test("Git.clone() checks out a branch", async () => {
  await using remote = await tempRepo();
  const target = await remote.commit("first", { allowEmpty: true });
  await remote.commit("second", { allowEmpty: true });
  await remote.checkout({ target, newBranch: "branch" });
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.clone(remote.directory, { branch: "branch" });
  assertEquals(await repo.log(), [target]);
});

Deno.test("Git.clone() configures repo", async () => {
  await using remote = await tempRepo();
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.clone(remote.directory, {
    config: { user: { name: "name", email: "email" } },
  });
  const commit = await repo.commit("summary", {
    sign: false,
    allowEmpty: true,
  });
  assertEquals(commit?.author, { name: "name", email: "email" });
});

Deno.test("Git.clone() can do a shallow copy", async () => {
  await using remote = await tempRepo();
  await remote.commit("first", { allowEmpty: true });
  await remote.commit("second", { allowEmpty: true });
  const third = await remote.commit("third", { allowEmpty: true });
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.clone(remote.directory, { depth: 1, local: false });
  assertEquals(await repo.log(), [third]);
});

Deno.test("Git.clone() can do a shallow copy of multiple branches", async () => {
  await using remote = await tempRepo();
  await remote.checkout({ newBranch: "branch1" });
  const first = await remote.commit("first", { allowEmpty: true });
  await remote.checkout({ newBranch: "branch2" });
  await remote.commit("second", { allowEmpty: true });
  const third = await remote.commit("third", { allowEmpty: true });
  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });
  await repo.clone(remote.directory, {
    branch: "branch1",
    depth: 1,
    local: false,
    singleBranch: false,
  });
  assertEquals(await repo.log(), [first]);
  await repo.checkout({ target: "branch2" });
  assertEquals(await repo.log(), [third]);
});

Deno.test("Git.checkout() stays at current branch", async () => {
  await using repo = await tempRepo();
  await repo.commit("summary", { allowEmpty: true });
  const branch = await repo.branch();
  await repo.checkout();
  assertEquals(await repo.branch(), branch);
});

Deno.test("Git.checkout() switches to branch", async () => {
  await using repo = await tempRepo();
  const main = await repo.branch();
  assertExists(main);
  const commit1 = await repo.commit("first", { allowEmpty: true });
  await repo.checkout({ newBranch: "branch" });
  const commit2 = await repo.commit("second", { allowEmpty: true });
  assertEquals(await repo.branch(), "branch");
  assertEquals(await repo.log(), [commit2, commit1]);
  await repo.checkout({ target: main });
  assertEquals(await repo.branch(), main);
  assertEquals(await repo.log(), [commit1]);
  await repo.checkout({ target: "branch" });
  assertEquals(await repo.branch(), "branch");
  assertEquals(await repo.log(), [commit2, commit1]);
});

Deno.test("Git.checkout() switches to commit", async () => {
  await using repo = await tempRepo();
  const main = await repo.branch();
  assertExists(main);
  const commit1 = await repo.commit("first", { allowEmpty: true });
  await repo.checkout({ target: commit1 });
  assertEquals(await repo.branch(), undefined);
  assertEquals(await repo.log(), [commit1]);
  await repo.checkout({ newBranch: "branch" });
  const commit2 = await repo.commit("second", { allowEmpty: true });
  await repo.checkout({ target: commit1 });
  assertEquals(await repo.branch(), undefined);
  assertEquals(await repo.log(), [commit1]);
  await repo.checkout({ target: commit2 });
  assertEquals(await repo.branch(), undefined);
  assertEquals(await repo.log(), [commit2, commit1]);
});

Deno.test("Git.checkout() can detach", async () => {
  await using repo = await tempRepo();
  await repo.commit("summary", { allowEmpty: true });
  const branch = await repo.branch();
  await repo.checkout();
  assertEquals(await repo.branch(), branch);
});

Deno.test("Git.branch() returns current branch", async () => {
  await using repo = await tempRepo();
  await repo.commit("summary", { allowEmpty: true });
  await repo.checkout({ newBranch: "branch" });
  assertEquals(await repo.branch(), "branch");
});

Deno.test("Git.branch() is undefined on detached state", async () => {
  await using repo = await tempRepo();
  await repo.commit("summary", { allowEmpty: true });
  assertNotEquals(await repo.branch(), undefined);
  await repo.checkout({ detach: true });
  assertEquals(await repo.branch(), undefined);
});

Deno.test("Git.add() adds files", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file"), "content");
  await repo.add("file");
  const commit = await repo.commit("summary");
  assertEquals(commit?.summary, "summary");
});

Deno.test("Git.add() fails to add non-existent file", async () => {
  await using repo = await tempRepo();
  await assertRejects(() => repo.add("file"));
});

Deno.test("Git.remove() fails to remove non-existent file", async () => {
  await using repo = await tempRepo();
  await assertRejects(() => repo.remove("file"));
});

Deno.test("Git.remove() removes files", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file"), "content");
  repo.add("file");
  await repo.commit("first");
  repo.remove("file");
  await repo.commit("second");
  await assertRejects(() => Deno.stat(repo.path("file")));
});

Deno.test("Git.commit() creates a commit", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file"), "content");
  await repo.add("file");
  const commit = await repo.commit("summary");
  assertEquals(commit?.summary, "summary");
});

Deno.test("Git.commit() can amend a commit", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file"), "content");
  await repo.add("file");
  await repo.commit("summary");
  const commit = await repo.commit("new summary", { amend: true });
  assertEquals(commit?.summary, "new summary");
});

Deno.test("Git.commit() fails on empty commit", async () => {
  await using repo = await tempRepo();
  await assertRejects(() => repo.commit("summary"));
});

Deno.test("Git.commit() can create empty commit", async () => {
  await using repo = await tempRepo();
  const commit = await repo.commit("summary", { allowEmpty: true });
  assertEquals(commit?.summary, "summary");
});

Deno.test("Git.commit() can set author", async () => {
  await using repo = await tempRepo();
  const commit = await repo.commit("summary", {
    author: { name: "name", email: "email@example.com" },
    allowEmpty: true,
  });
  assertEquals(commit?.author, { name: "name", email: "email@example.com" });
});

Deno.test("Git.commit() can set committer", async () => {
  await using repo = await tempRepo();
  await repo.config({
    user: { name: "name", email: "email@example.com" },
  });
  const commit = await repo.commit("summary", {
    author: { name: "other", email: "other@example.com" },
    allowEmpty: true,
  });
  assertEquals(commit?.committer, { name: "name", email: "email@example.com" });
});

Deno.test("Git.log() fails on non-repo", async () => {
  await using repo = await tempRepo();
  await assertRejects(() => repo.log());
});

Deno.test("Git.log() fails on empty repo", async () => {
  await using repo = await tempRepo();
  await assertRejects(() => repo.log());
});

Deno.test("Git.log() returns single commit", async () => {
  await using repo = await tempRepo();
  const commit = await repo.commit("summary", { allowEmpty: true });
  assertEquals(await repo.log(), [commit]);
});

Deno.test("Git.log() returns multiple commits", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", { allowEmpty: true });
  const commit2 = await repo.commit("second", { allowEmpty: true });
  assertEquals(await repo.log(), [commit2, commit1]);
});

Deno.test("Git.log() returns file changes", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file1"), "content");
  await repo.add("file1");
  const commit1 = await repo.commit("first");
  await Deno.writeTextFile(repo.path("file2"), "content");
  await repo.add("file2");
  const commit2 = await repo.commit("second");
  assertEquals(await repo.log({ paths: ["file1"] }), [commit1]);
  assertEquals(await repo.log({ paths: ["file2"] }), [commit2]);
  assertEquals(await repo.log({ paths: ["file1", "file2"] }), [
    commit2,
    commit1,
  ]);
});

Deno.test("Git.log() returns blame", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file1"), "content1");
  await repo.add("file1");
  const commit1 = await repo.commit("first");
  await Deno.writeTextFile(repo.path("file2"), "content2");
  await repo.add("file2");
  const commit2 = await repo.commit("second");
  assertEquals(await repo.log({ text: "content1" }), [commit1]);
  assertEquals(await repo.log({ text: "content2" }), [commit2]);
});

Deno.test("Git.log() returns blame from multiple files", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file1"), "content1");
  await repo.add("file1");
  const commit1 = await repo.commit("first");
  await Deno.writeTextFile(repo.path("file2"), "content2");
  await repo.add("file2");
  const commit2 = await repo.commit("second");
  assertEquals(await repo.log({ text: "content" }), [commit2, commit1]);
});

Deno.test("Git.log() returns blame from specific file", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file1"), "content1");
  await repo.add("file1");
  const commit1 = await repo.commit("first");
  await Deno.writeTextFile(repo.path("file2"), "content2");
  await repo.add("file2");
  const commit2 = await repo.commit("second");
  assertEquals(await repo.log({ paths: ["file1"], text: "content" }), [
    commit1,
  ]);
  assertEquals(await repo.log({ paths: ["file2"], text: "content" }), [
    commit2,
  ]);
});

Deno.test("Git.log() can match extended regexp", async () => {
  await using repo = await tempRepo();
  await Deno.writeTextFile(repo.path("file1"), "content1");
  await repo.add("file1");
  const commit1 = await repo.commit("first");
  await Deno.writeTextFile(repo.path("file2"), "content2");
  await repo.add("file2");
  const commit2 = await repo.commit("second");
  assertEquals(await repo.log({ text: "content[12]" }), [commit2, commit1]);
  assertEquals(await repo.log({ text: ".+\d?" }), [commit2, commit1]);
});

Deno.test("Git.log() returns commit descendants", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", { allowEmpty: true });
  const commit2 = await repo.commit("second", { allowEmpty: true });
  assertEquals(await repo.log({ range: { from: commit1 } }), [commit2]);
});

Deno.test("Git.log() returns commit range", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", { allowEmpty: true });
  const commit2 = await repo.commit("second", { allowEmpty: true });
  await repo.commit("third", { allowEmpty: true });
  assertEquals(await repo.log({ range: { from: commit1, to: commit2 } }), [
    commit2,
  ]);
});

Deno.test("Git.log() filters by author", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", {
    author: { name: "name1", email: "email1@example.com" },
    allowEmpty: true,
  });
  const commit2 = await repo.commit("second", {
    author: { name: "name2", email: "email2@example.com" },
    allowEmpty: true,
  });
  assertEquals(
    await repo.log({ author: { name: "name1", email: "email1@example.com" } }),
    [commit1],
  );
  assertEquals(
    await repo.log({ author: { name: "name2", email: "email2@example.com" } }),
    [commit2],
  );
});

Deno.test("Git.log() filters by committer", async () => {
  await using repo = await tempRepo();
  await repo.config({ user: { name: "name1", email: "email1@example.com" } });
  const commit1 = await repo.commit("first", {
    author: { name: "other", email: "other@example.com" },
    allowEmpty: true,
  });
  await repo.config({ user: { name: "name2", email: "email2@example.com" } });
  const commit2 = await repo.commit("second", {
    author: { name: "other", email: "other@example.com" },
    allowEmpty: true,
  });
  assertEquals(
    await repo.log({
      committer: { name: "name1", email: "email1@example.com" },
    }),
    [commit1],
  );
  assertEquals(
    await repo.log({
      committer: { name: "name2", email: "email2@example.com" },
    }),
    [commit2],
  );
});

Deno.test("Git.tag() creates a lightweight tag", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  const tag = await repo.tag("tag");
  assertEquals(tag, { name: "tag" });
});

Deno.test("Git.tag() creates an annotated tag", async () => {
  await using repo = await tempRepo();
  await repo.config({ user: { name: "tagger", email: "tagger@example.com" } });
  await repo.commit("first", { allowEmpty: true });
  const tag = await repo.tag("tag", { subject: "subject", body: "body" });
  assertEquals(tag, {
    name: "tag",
    tagger: { name: "tagger", email: "tagger@example.com" },
    subject: "subject",
    body: "body\n",
  });
});

Deno.test("Git.tag() creates a tag with commit", async () => {
  await using repo = await tempRepo();
  const commit = await repo.commit("first", { allowEmpty: true });
  const tag = await repo.tag("tag", { commit });
  assertEquals(tag, { name: "tag" });
});

Deno.test("Git.tag() creates a tag with another tag", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag1");
  await repo.tag("tag2", { commit: "tag1" });
  const tags = await repo.tagList();
  assertEquals(tags, [{ name: "tag1" }, { name: "tag2" }]);
});

Deno.test("Git.tag() fails to create duplicate tag", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag");
  await assertRejects(() => repo.tag("tag"));
});

Deno.test("Git.tagList() return empty list on empty repo", async () => {
  await using repo = await tempRepo();
  assertEquals(await repo.tagList(), []);
});

Deno.test("Git.tagList() return empty list on no tags repo", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  assertEquals(await repo.tagList(), []);
});

Deno.test("Git.tagList() returns single tag", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag");
  assertEquals(await repo.tagList(), [{ name: "tag" }]);
});

Deno.test("Git.tagList() returns multiple tags with version sort", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  await repo.tag("v1.0.0");
  await repo.commit("second", { allowEmpty: true });
  await repo.tag("v2.0.0");
  assertEquals(await repo.tagList({ sort: "version" }), [
    { name: "v2.0.0" },
    { name: "v1.0.0" },
  ]);
});

Deno.test("Git.tagList() matches tag name", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag1");
  await repo.tag("tag2");
  assertEquals(await repo.tagList({ name: "tag2" }), [{ name: "tag2" }]);
});

Deno.test("Git.tagList() matches tag pattern", async () => {
  await using repo = await tempRepo();
  await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag1");
  await repo.tag("tag2");
  assertEquals(await repo.tagList({ name: "tag*" }), [
    { name: "tag1" },
    { name: "tag2" },
  ]);
});

Deno.test("Git.tagList() returns tags that contain commit", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag1");
  const commit2 = await repo.commit("second", { allowEmpty: true });
  await repo.tag("tag2");
  assertEquals(await repo.tagList({ contains: commit1 }), [
    { name: "tag1" },
    { name: "tag2" },
  ]);
  assertEquals(await repo.tagList({ contains: commit2 }), [
    { name: "tag2" },
  ]);
});

Deno.test("Git.tagList() returns tags that do not contain commit", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", { allowEmpty: true });
  await repo.tag("tag1");
  const commit2 = await repo.commit("second", { allowEmpty: true });
  await repo.tag("tag2");
  assertEquals(await repo.tagList({ noContains: commit1 }), []);
  assertEquals(await repo.tagList({ noContains: commit2 }), [
    { name: "tag1" },
  ]);
});

Deno.test("Git.tagList() returns commit range", async () => {
  await using repo = await tempRepo();
  const commit1 = await repo.commit("first", { allowEmpty: true });
  const commit2 = await repo.commit("second", { allowEmpty: true });
  await repo.commit("third", { allowEmpty: true });
  assertEquals(await repo.log({ range: { from: commit1, to: commit2 } }), [
    commit2,
  ]);
});

Deno.test("Git.addRemote() adds remote URL", async () => {
  await using repo = await tempRepo();
  await repo.addRemote("url");
  assertEquals(await repo.remote(), "url");
});

Deno.test("Git.addRemote() cannot add to the same remote", async () => {
  await using repo = await tempRepo();
  await repo.addRemote("url1");
  await assertRejects(() => repo.addRemote("url2"));
});

Deno.test("Git.addRemote() cannot add multiple remotes", async () => {
  await using repo = await tempRepo();
  await repo.addRemote("url1", { remote: "remote1" });
  await repo.addRemote("url2", { remote: "remote2" });
  assertEquals(await repo.remote({ remote: "remote1" }), "url1");
  assertEquals(await repo.remote({ remote: "remote2" }), "url2");
});

Deno.test("Git.remote() returns remote URL", async () => {
  await using repo = await tempRepo();
  await repo.addRemote("url", { remote: "downstream" });
  assertEquals(await repo.remote({ remote: "downstream" }), "url");
});

Deno.test("Git.remoteBase() returns remote head branch", async () => {
  await using remote = await tempRepo({ bare: true });
  const head = await remote.branch();
  await using repo = await tempRepo({ clone: remote });
  await repo.commit("initial", { allowEmpty: true });
  await repo.push();
  assertEquals(await repo.remoteBase(), head);
});

Deno.test("Git.push() pushes commits to remote", async () => {
  await using remote = await tempRepo({ bare: true });
  await using repo = await tempRepo({ clone: remote });
  const commit1 = await repo.commit("second", { allowEmpty: true });
  const commit2 = await repo.commit("third", { allowEmpty: true });
  await repo.push();
  assertEquals(await repo.log(), [commit2, commit1]);
});

Deno.test("Git.pushTag() pushes tags to remote", async () => {
  await using remote = await tempRepo({ bare: true });
  await using repo = await tempRepo({ clone: remote });
  await repo.commit("initial", { allowEmpty: true });
  await repo.tag("tag");
  await repo.push();
  await repo.pushTag("tag");
  assertEquals(await repo.tagList(), [{ name: "tag" }]);
});

Deno.test("Git.pull() pulls commits and tags", async () => {
  await using remote = await tempRepo({ bare: true });
  await using repo = await tempRepo({ clone: remote });
  await using other = await tempRepo({ clone: remote });
  const commit = await other.commit("initial", { allowEmpty: true });
  await other.tag("tag");
  await other.push();
  await other.pushTag("tag");
  await repo.pull();
  assertEquals(await repo.log(), [commit]);
  assertEquals(await repo.tagList(), [{ name: "tag" }]);
});

Deno.test("Git.pull() can skip tags", async () => {
  await using remote = await tempRepo({ bare: true });
  await using repo = await tempRepo({ clone: remote });
  await using other = await tempRepo({ clone: remote });
  const commit = await other.commit("initial", { allowEmpty: true });
  await other.tag("tag");
  await other.push();
  await other.pushTag("tag");
  await repo.pull({ tags: false });
  assertEquals(await repo.log(), [commit]);
  assertEquals(await repo.tagList(), []);
});

Deno.test("Git.pull() does not fetch all tags", async () => {
  await using remote = await tempRepo({ bare: true });
  await using repo = await tempRepo({ clone: remote });
  await using other = await tempRepo({ clone: remote });
  const commit = await other.commit("initial", { allowEmpty: true });
  await other.tag("tag1");
  await other.push();
  await other.pushTag("tag1");
  await other.checkout({ newBranch: "branch" });
  await other.commit("second", { allowEmpty: true });
  await other.tag("tag2");
  await other.pushTag("tag2");
  await repo.pull();
  assertEquals(await repo.log(), [commit]);
  assertEquals(await repo.tagList(), [{ name: "tag1" }]);
});

Deno.test("Git.pull() can fetch all tags", async () => {
  await using remote = await tempRepo({ bare: true });
  await using repo = await tempRepo({ clone: remote });
  await using other = await tempRepo({ clone: remote });
  const commit = await other.commit("initial", { allowEmpty: true });
  await other.tag("tag1");
  await other.push();
  await other.pushTag("tag1");
  await other.checkout({ newBranch: "branch" });
  await other.commit("second", { allowEmpty: true });
  await other.tag("tag2");
  await other.pushTag("tag2");
  await repo.pull({ tags: true });
  assertEquals(await repo.log(), [commit]);
  assertEquals(await repo.tagList(), [{ name: "tag1" }, { name: "tag2" }]);
});

Deno.test("conventional() creates conventional commits", () => {
  const commit = testCommit("feat(module): summary");
  assertEquals(conventional(commit), {
    ...commit,
    description: "summary",
    type: "feat",
    modules: ["module"],
    breaking: false,
  });
});

Deno.test("conventional() accepts be simple commits", () => {
  const commit = testCommit("summary");
  assertEquals(conventional(commit), {
    ...commit,
    description: "summary",
    type: undefined,
    modules: [],
    breaking: false,
  });
});

Deno.test("conventional() can create breaking commits", () => {
  const commit = testCommit("feat!: summary");
  assertEquals(conventional(commit), {
    ...commit,
    description: "summary",
    type: "feat",
    modules: [],
    breaking: true,
  });
});

Deno.test("conventional() can create breaking commits from footer", () => {
  const commit = {
    ...testCommit("feat: summary"),
    body: "BREAKING CHANGE: breaking",
  };
  assertEquals(conventional(commit), {
    ...commit,
    description: "summary",
    type: "feat",
    modules: [],
    breaking: true,
  });
});

Deno.test("conventional() can create breaking commit with module", () => {
  const commit = testCommit("feat(module)!: summary");
  assertEquals(conventional(commit), {
    ...commit,
    description: "summary",
    type: "feat",
    modules: ["module"],
    breaking: true,
  });
});

Deno.test("conventional() can create multiple modules", () => {
  const commit = testCommit("feat(module1,module2): summary");
  assertEquals(conventional(commit), {
    ...commit,
    description: "summary",
    type: "feat",
    modules: ["module1", "module2"],
    breaking: false,
  });
});
