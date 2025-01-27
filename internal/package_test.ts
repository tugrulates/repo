import { assertEquals, assertRejects } from "@std/assert";
import {
  bumpVersion,
  findCommitsSinceLastRelease,
  getPackage,
  getWorkspacePackages,
  setPackage,
} from "@tugrulates/internal/package";
import { tempDir } from "@tugrulates/testing";
import { gitCommit, gitInit, gitTag } from "./git.ts";

Deno.test("getPackage() returns current package", async () => {
  const pkg = await getPackage();
  assertEquals(pkg.config.name, "@tugrulates/internal");
});

Deno.test("getPackage() returns given package", async () => {
  await using repo = await tempDir();

  await setPackage({
    directory: repo.path,
    config: { name: "package_name", version: "package_version" },
  });
  const pkg = await getPackage(repo.path);

  assertEquals(pkg, {
    directory: repo.path,
    config: { name: "package_name", version: "package_version" },
  });
});

Deno.test("getPackage() fails on non-Deno package", async () => {
  await using repo = await tempDir();
  await assertRejects(() => getPackage(repo.path));
});

Deno.test("getWorkspacePackages() returns non-workspace package", async () => {
  await using repo = await tempDir();

  await Deno.writeTextFile(
    `${repo.path}/deno.json`,
    JSON.stringify({ name: "package_name", version: "package_version" }),
  );

  const packages = await getWorkspacePackages(repo.path);

  assertEquals(packages, [{
    directory: repo.path,
    config: { name: "package_name", version: "package_version" },
  }]);
});

Deno.test("getWorkspacePackages() returns workspace packages", async () => {
  await using repo = await tempDir();

  await setPackage({
    directory: repo.path,
    config: { workspace: ["./first", "./second"] },
  });
  await setPackage({
    directory: `${repo.path}/first`,
    config: { name: "first", version: "first_version" },
  });
  await setPackage({
    directory: `${repo.path}/second`,
    config: { name: "second", version: "second_version" },
  });

  const packages = await getWorkspacePackages(repo.path);

  assertEquals(packages, [{
    directory: repo.path,
    config: { workspace: ["./first", "./second"] },
  }, {
    directory: `${repo.path}/first`,
    config: { name: "first", version: "first_version" },
  }, {
    directory: `${repo.path}/second`,
    config: { name: "second", version: "second_version" },
  }]);
});

Deno.test("getWorkspacePackages() returns nested workspace packages", async () => {
  await using repo = await tempDir();

  await setPackage({
    directory: repo.path,
    config: { workspace: ["./first"] },
  });
  await setPackage({
    directory: `${repo.path}/first`,
    config: {
      name: "first",
      version: "first_version",
      workspace: ["./second"],
    },
  });
  await setPackage({
    directory: `${repo.path}/first/second`,
    config: { name: "second", version: "second_version" },
  });

  const packages = await getWorkspacePackages(repo.path);

  assertEquals(packages, [{
    directory: repo.path,
    config: { workspace: ["./first"] },
  }, {
    directory: `${repo.path}/first`,
    config: {
      name: "first",
      version: "first_version",
      workspace: ["./second"],
    },
  }, {
    directory: `${repo.path}/first/second`,
    config: { name: "second", version: "second_version" },
  }]);
});

Deno.test("findCommitsSinceLastRelease() fails with unnamed package", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await setPackage({ directory: repo.path, config: {} });
  await gitCommit({ repo: repo.path, message: "first", add: ["deno.json"] });
  const pkg = await getPackage(repo.path);
  await assertRejects(() => findCommitsSinceLastRelease(pkg));
});

Deno.test("findCommitsSinceLastRelease() fails with no commits", async () => {
  await using repo = await tempDir();
  await gitInit({ repo: repo.path });
  await setPackage({ directory: repo.path, config: { name: "@scope/name" } });
  const pkg = await getPackage(repo.path);
  await assertRejects(() => findCommitsSinceLastRelease(pkg));
});

Deno.test(
  "findCommitsSinceLastRelease() finds all commits for unversioned package",
  async () => {
    await using repo = await tempDir();
    await gitInit({ repo: repo.path });

    await setPackage({ directory: repo.path, config: { name: "@scope/name" } });
    await gitCommit({
      repo: repo.path,
      message: "feat(name): first",
      add: ["deno.json"],
    });

    const pkg = await getPackage(repo.path);

    assertEquals((await findCommitsSinceLastRelease(pkg)).map((c) => c.title), [
      "feat(name): first",
    ]);
  },
);

Deno.test(
  "findCommitsSinceLastRelease() finds commits after version change",
  async () => {
    await using repo = await tempDir();
    await gitInit({ repo: repo.path });

    await setPackage({
      directory: repo.path,
      config: { name: "@scope/name", version: "1" },
    });
    await gitCommit({
      repo: repo.path,
      message: "feat(name): first",
      add: ["deno.json"],
    });
    await gitTag("name@1", { repo: repo.path });
    await Deno.writeTextFile(`${repo.path}/file`, "contents");
    await gitCommit({
      repo: repo.path,
      message: "fix(name,other): second",
      add: ["file"],
    });
    await gitCommit({
      repo: repo.path,
      message: "fix(other): third",
      remove: ["file"],
    });
    await gitCommit({
      repo: repo.path,
      message: "fix(*): fourth",
    });

    const pkg = await getPackage(repo.path);

    assertEquals((await findCommitsSinceLastRelease(pkg)).map((c) => c.title), [
      "fix(*): fourth",
      "fix(name,other): second",
    ]);
  },
);

Deno.test(
  "bumpVersion() applies no release for no change",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(bumpVersion(pkg, []), "1.2.3");
  },
);

Deno.test(
  "bumpVersion() applies no release for unknown change",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash",
        title: "chore(name): message",
        type: "chore",
        modules: ["name"],
        breaking: false,
      }]),
      "1.2.3",
    );
  },
);

Deno.test(
  "bumpVersion() applies patch release for fix change",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash",
        title: "fix(name): message",
        type: "fix",
        modules: ["name"],
        breaking: false,
      }]),
      "1.2.4",
    );
  },
);

Deno.test(
  "bumpVersion() applies minor release for feat change",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash",
        title: "feat(name): message",
        type: "feat",
        modules: ["name"],
        breaking: false,
      }]),
      "1.3.0",
    );
  },
);

Deno.test(
  "bumpVersion() applies patch release for multiple changes with feat",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash1",
        title: "fix(name): message",
        type: "fix",
        modules: ["name"],
        breaking: false,
      }, {
        hash: "hash2",
        title: "feat(name): message",
        type: "feat",
        modules: ["name"],
        breaking: false,
      }]),
      "1.3.0",
    );
  },
);

Deno.test(
  "bumpVersion() applies major release for breaking change",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash",
        title: "refactor(name)!: message",
        type: "refactor",
        modules: ["name"],
        breaking: true,
      }]),
      "2.0.0",
    );
  },
);

Deno.test(
  "bumpVersion() applies major release for breaking change among others",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash1",
        title: "fix(name): message",
        type: "fix",
        modules: ["name"],
        breaking: false,
      }, {
        hash: "hash2",
        title: "feat(name): message",
        type: "feat",
        modules: ["name"],
        breaking: false,
      }, {
        hash: "hash",
        title: "refactor(name)!: message",
        type: "refactor",
        modules: ["name"],
        breaking: true,
      }]),
      "2.0.0",
    );
  },
);

Deno.test(
  "bumpVersion() applies minor release for breaking change for pre-major version",
  () => {
    const pkg = {
      directory: "directory",
      config: { name: "@scope/name", version: "0.2.3" },
    };
    assertEquals(
      bumpVersion(pkg, [{
        hash: "hash",
        title: "refactor(name)!: message",
        type: "refactor",
        modules: ["name"],
        breaking: true,
      }]),
      "0.3.0",
    );
  },
);
