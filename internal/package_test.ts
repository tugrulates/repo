import { assertEquals, assertRejects } from "@std/assert";
import { basename } from "@std/path/basename";
import { parse } from "@std/semver";
import { type Git, type GitCommit, gitRepo } from "@tugrulates/internal/git";
import {
  getChangelog,
  getPackage,
  getWorkspace,
  updateType,
  writeConfig,
} from "@tugrulates/internal/package";

async function tempRepo(
  { bare, clone }: { bare?: boolean; clone?: Git } = {},
): Promise<Git & AsyncDisposable> {
  const repo = gitRepo({ directory: await Deno.makeTempDir() });
  Object.assign(repo, {
    [Symbol.asyncDispose]: () =>
      Deno.remove(repo.directory, { recursive: true }),
  });
  if (clone) await repo.clone(clone.directory);
  await repo.init(bare !== undefined ? { bare } : {});
  await repo.config({
    user: { name: "A U Thor", email: "author@example.com" },
    commit: { gpgsign: false },
    tag: { gpgsign: false },
  });
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

Deno.test("getPackage() returns current package", async () => {
  const pkg = await getPackage();
  assertEquals(pkg.config.name, "@tugrulates/internal");
});

Deno.test("getPackage() returns given package", async () => {
  await using repo = await tempRepo();

  await writeConfig({
    directory: repo.directory,
    module: "name",
    config: { name: "name", version: "version" },
  });
  const pkg = await getPackage({ directory: repo.directory });

  assertEquals(pkg, {
    directory: repo.directory,
    module: "name",
    config: { name: "name", version: "version" },
  });
});

Deno.test("getPackage() fails on non-Deno package", async () => {
  await using repo = await tempRepo();
  await assertRejects(() => getPackage({ directory: repo.directory }));
});

Deno.test("getWorkspacePackages() returns non-workspace package", async () => {
  await using repo = await tempRepo();

  await Deno.writeTextFile(
    repo.path("deno.json"),
    JSON.stringify({ name: "name", version: "version" }),
  );

  const packages = await getWorkspace({ directories: [repo.directory] });

  assertEquals(packages, [{
    directory: repo.directory,
    module: "name",
    config: { name: "name", version: "version" },
  }]);
});

Deno.test("getWorkspacePackages() returns workspace packages", async () => {
  await using repo = await tempRepo();

  await writeConfig({
    directory: repo.directory,
    module: basename(repo.directory),
    config: { workspace: ["./first", "./second"] },
  });
  await writeConfig({
    directory: repo.path("first"),
    module: "first",
    config: { name: "first", version: "first_version" },
  });
  await writeConfig({
    directory: repo.path("second"),
    module: "second",
    config: { name: "second", version: "second_version" },
  });

  const packages = await getWorkspace({ directories: [repo.directory] });

  assertEquals(packages, [{
    directory: repo.directory,
    module: basename(repo.directory),
    config: { workspace: ["./first", "./second"] },
  }, {
    directory: repo.path("first"),
    module: "first",
    config: { name: "first", version: "first_version" },
  }, {
    directory: repo.path("second"),
    module: "second",
    config: { name: "second", version: "second_version" },
  }]);
});

Deno.test("getWorkspacePackages() returns nested workspace packages", async () => {
  await using repo = await tempRepo();

  await writeConfig({
    directory: repo.directory,
    module: basename(repo.directory),
    config: { workspace: ["./first"] },
  });
  await writeConfig({
    directory: repo.path("first"),
    module: "first",
    config: {
      name: "first",
      version: "first_version",
      workspace: ["./second"],
    },
  });
  await writeConfig({
    directory: repo.path("first/second"),
    module: "second",
    config: { name: "second", version: "second_version" },
  });

  const packages = await getWorkspace({ directories: [repo.directory] });

  assertEquals(packages, [{
    directory: repo.directory,
    module: basename(repo.directory),
    config: { workspace: ["./first"] },
  }, {
    directory: repo.path("first"),
    module: "first",
    config: {
      name: "first",
      version: "first_version",
      workspace: ["./second"],
    },
  }, {
    directory: repo.path("first/second"),
    module: "second",
    config: { name: "second", version: "second_version" },
  }]);
});

/** @todo fix */
Deno.test.ignore("getChangelog() fails with unnamed package", async () => {
  await using repo = await tempRepo();
  await writeConfig({
    directory: repo.directory,
    module: "module",
    config: {},
  });
  await repo.add("deno.json");
  await repo.commit("first");
  const pkg = await getPackage({ directory: repo.directory });
  await assertRejects(() => getChangelog(pkg));
});

Deno.test("getChangelog() fails with no commits", async () => {
  await using repo = await tempRepo();
  await writeConfig({
    directory: repo.directory,
    module: "module",
    config: { name: "@scope/name" },
  });
  const pkg = await getPackage({ directory: repo.directory });
  await assertRejects(() => getChangelog(pkg));
});

Deno.test("getChangelog() finds all commits for unversioned package", async () => {
  await using repo = await tempRepo();
  await writeConfig({
    directory: repo.directory,
    module: "name",
    config: { name: "@scope/name" },
  });
  await repo.add("deno.json");
  await repo.commit("feat(name): first");
  const pkg = await getPackage({ directory: repo.directory });

  assertEquals((await getChangelog(pkg)).map((c) => c.summary), [
    "feat(name): first",
  ]);
});

Deno.test("getChangelog() finds commits after version change", async () => {
  await using repo = await tempRepo();
  await writeConfig({
    directory: repo.directory,
    module: "name",
    config: { name: "@scope/name", version: "1.0.0" },
  });
  await repo.add("deno.json");
  await repo.commit("feat(name): first");
  await repo.tag("name@1.0.0");
  await repo.commit("fix(name,other): second", { allowEmpty: true });
  await repo.commit("fix(other): third", { allowEmpty: true });
  await repo.commit("fix(*): fourth", { allowEmpty: true });

  const pkg = await getPackage({ directory: repo.directory });

  assertEquals((await getChangelog(pkg)).map((c) => c.summary), [
    "fix(*): fourth",
    "fix(name,other): second",
  ]);
});

Deno.test("updateType() applies no update for no change", () => {
  assertEquals(updateType(parse("1.2.3"), []), undefined);
});

Deno.test("updateType() applies patch release for unknown change", () => {
  assertEquals(
    updateType(parse("1.2.3"), [
      testCommit("unknown"),
    ]),
    "patch",
  );
});

Deno.test(
  "updateType() applies patch release for fix change",
  () => {
    assertEquals(
      updateType(parse("1.2.3"), [
        testCommit("fix(name): message"),
      ]),
      "patch",
    );
  },
);

Deno.test(
  "updateType() applies minor release for feat change",
  () => {
    assertEquals(
      updateType(parse("1.2.3"), [
        testCommit("feat(name): message"),
      ]),
      "minor",
    );
  },
);

Deno.test(
  "updateType() applies minor release for multiple changes with feat",
  () => {
    assertEquals(
      updateType(parse("1.2.3"), [
        testCommit("fix(name): message"),
        testCommit("feat(name): message"),
      ]),
      "minor",
    );
  },
);

Deno.test("updateType() applies major release for breaking change", () => {
  assertEquals(
    updateType(parse("1.2.3"), [testCommit("refactor(name)!: message")]),
    "major",
  );
});

Deno.test("updateType() applies major release for breaking change among others", () => {
  assertEquals(
    updateType(parse("1.2.3"), [
      testCommit("fix(name): message"),
      testCommit("feat(name): message"),
      testCommit("refactor(name)!: message"),
    ]),
    "major",
  );
});

Deno.test("updateType() applies minor release for breaking change for pre-major version", () => {
  assertEquals(
    updateType(parse("0.2.3"), [
      testCommit("refactor(name)!: message"),
    ]),
    "minor",
  );
});
