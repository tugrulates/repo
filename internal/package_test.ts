import { assertEquals, assertRejects } from "@std/assert";
import { basename } from "@std/path/basename";
import {
  calculateVersion,
  getChangelog,
  getPackage,
  getWorkspace,
  writeConfig,
} from "@tugrulates/internal/package";
import { tempDir } from "@tugrulates/testing";
import { gitCommit, gitInit, gitTag } from "./git.ts";

Deno.test("getPackage() returns current package", async () => {
  const pkg = await getPackage();
  assertEquals(pkg.config.name, "@tugrulates/internal");
});

Deno.test("getPackage() returns given package", async () => {
  await using repo = await tempDir();

  await writeConfig({
    directory: repo.path,
    module: "name",
    config: { name: "name", version: "version" },
  });
  const pkg = await getPackage({ directory: repo.path });

  assertEquals(pkg, {
    directory: repo.path,
    module: "name",
    config: { name: "name", version: "version" },
  });
});

Deno.test("getPackage() fails on non-Deno package", async () => {
  await using repo = await tempDir();
  await assertRejects(() => getPackage({ directory: repo.path }));
});

Deno.test("getWorkspacePackages() returns non-workspace package", async () => {
  await using repo = await tempDir();

  await Deno.writeTextFile(
    `${repo.path}/deno.json`,
    JSON.stringify({ name: "name", version: "version" }),
  );

  const packages = await getWorkspace({ directories: [repo.path] });

  assertEquals(packages, [{
    directory: repo.path,
    module: "name",
    config: { name: "name", version: "version" },
  }]);
});

Deno.test("getWorkspacePackages() returns workspace packages", async () => {
  await using repo = await tempDir();

  await writeConfig({
    directory: repo.path,
    module: basename(repo.path),
    config: { workspace: ["./first", "./second"] },
  });
  await writeConfig({
    directory: `${repo.path}/first`,
    module: "first",
    config: { name: "first", version: "first_version" },
  });
  await writeConfig({
    directory: `${repo.path}/second`,
    module: "second",
    config: { name: "second", version: "second_version" },
  });

  const packages = await getWorkspace({ directories: [repo.path] });

  assertEquals(packages, [{
    directory: repo.path,
    module: basename(repo.path),
    config: { workspace: ["./first", "./second"] },
  }, {
    directory: `${repo.path}/first`,
    module: "first",
    config: { name: "first", version: "first_version" },
  }, {
    directory: `${repo.path}/second`,
    module: "second",
    config: { name: "second", version: "second_version" },
  }]);
});

Deno.test("getWorkspacePackages() returns nested workspace packages", async () => {
  await using repo = await tempDir();

  await writeConfig({
    directory: repo.path,
    module: basename(repo.path),
    config: { workspace: ["./first"] },
  });
  await writeConfig({
    directory: `${repo.path}/first`,
    module: "first",
    config: {
      name: "first",
      version: "first_version",
      workspace: ["./second"],
    },
  });
  await writeConfig({
    directory: `${repo.path}/first/second`,
    module: "second",
    config: { name: "second", version: "second_version" },
  });

  const packages = await getWorkspace({ directories: [repo.path] });

  assertEquals(packages, [{
    directory: repo.path,
    module: basename(repo.path),
    config: { workspace: ["./first"] },
  }, {
    directory: `${repo.path}/first`,
    module: "first",
    config: {
      name: "first",
      version: "first_version",
      workspace: ["./second"],
    },
  }, {
    directory: `${repo.path}/first/second`,
    module: "second",
    config: { name: "second", version: "second_version" },
  }]);
});

/** @todo fix */
Deno.test.ignore("getChangelog() fails with unnamed package", async () => {
  await using repo = await tempDir();
  await gitInit({
    dir: repo.path,
    user: { name: "name", email: "email" },
  });
  await writeConfig({ directory: repo.path, module: "module", config: {} });
  await gitCommit({
    dir: repo.path,
    message: "first",
    add: ["deno.json"],
  });
  const pkg = await getPackage({ directory: repo.path });
  await assertRejects(() => getChangelog(pkg));
});

Deno.test("getChangelog() fails with no commits", async () => {
  await using repo = await tempDir();
  await gitInit({
    dir: repo.path,
    user: { name: "name", email: "email" },
  });
  await writeConfig({
    directory: repo.path,
    module: "module",
    config: { name: "@scope/name" },
  });
  const pkg = await getPackage({ directory: repo.path });
  await assertRejects(() => getChangelog(pkg));
});

Deno.test(
  "getChangelog() finds all commits for unversioned package",
  async () => {
    await using repo = await tempDir();
    await gitInit({
      dir: repo.path,
      user: { name: "name", email: "email" },
    });

    await writeConfig({
      directory: repo.path,
      module: "name",
      config: { name: "@scope/name" },
    });
    await gitCommit({
      dir: repo.path,
      message: "feat(name): first",
      add: ["deno.json"],
    });

    const pkg = await getPackage({ directory: repo.path });

    assertEquals((await getChangelog(pkg)).map((c) => c.title), [
      "feat(name): first",
    ]);
  },
);

Deno.test(
  "getChangelog() finds commits after version change",
  async () => {
    await using repo = await tempDir();
    await gitInit({
      dir: repo.path,
      user: { name: "name", email: "email" },
    });

    await writeConfig({
      directory: repo.path,
      module: "name",
      config: { name: "@scope/name", version: "1" },
    });
    await gitCommit({
      dir: repo.path,
      message: "feat(name): first",
      add: ["deno.json"],
    });
    await gitTag("name@1", { dir: repo.path });
    await Deno.writeTextFile(`${repo.path}/file`, "contents");
    await gitCommit({
      dir: repo.path,
      message: "fix(name,other): second",
      add: ["file"],
    });
    await gitCommit({
      dir: repo.path,
      message: "fix(other): third",
      remove: ["file"],
    });
    await gitCommit({
      dir: repo.path,
      message: "fix(*): fourth",
    });

    const pkg = await getPackage({ directory: repo.path });

    assertEquals((await getChangelog(pkg)).map((c) => c.title), [
      "fix(*): fourth",
      "fix(name,other): second",
    ]);
  },
);

Deno.test(
  "updateVersion() applies no update for no change",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(calculateVersion(pkg, []), "1.2.3");
  },
);

Deno.test(
  "updateVersion() applies patch release for unknown change",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash",
        author: "author",
        title: "chore(name): message",
        body: "",
        type: "chore",
        modules: ["name"],
        breaking: false,
      }]),
      "1.2.4",
    );
  },
);

Deno.test(
  "updateVersion() applies patch release for fix change",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash",
        author: "author",
        title: "fix(name): message",
        body: "",
        type: "fix",
        modules: ["name"],
        breaking: false,
      }]),
      "1.2.4",
    );
  },
);

Deno.test(
  "updateVersion() applies minor release for feat change",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash",
        author: "author",
        title: "feat(name): message",
        body: "",
        type: "feat",
        modules: ["name"],
        breaking: false,
      }]),
      "1.3.0",
    );
  },
);

Deno.test(
  "updateVersion() applies minor release for multiple changes with feat",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash1",
        author: "author",
        title: "fix(name): message",
        body: "",
        type: "fix",
        modules: ["name"],
        breaking: false,
      }, {
        hash: "hash2",
        author: "author",
        title: "feat(name): message",
        body: "",
        type: "feat",
        modules: ["name"],
        breaking: false,
      }]),
      "1.3.0",
    );
  },
);

Deno.test(
  "updateVersion() applies major release for breaking change",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash",
        author: "author",
        title: "refactor(name)!: message",
        body: "",
        type: "refactor",
        modules: ["name"],
        breaking: true,
      }]),
      "2.0.0",
    );
  },
);

Deno.test(
  "updateVersion() applies major release for breaking change among others",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "1.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash1",
        author: "author",
        title: "fix(name): message",
        body: "",
        type: "fix",
        modules: ["name"],
        breaking: false,
      }, {
        hash: "hash2",
        author: "author",
        title: "feat(name): message",
        body: "",
        type: "feat",
        modules: ["name"],
        breaking: false,
      }, {
        hash: "hash",
        author: "author",
        title: "refactor(name)!: message",
        body: "",
        type: "refactor",
        modules: ["name"],
        breaking: true,
      }]),
      "2.0.0",
    );
  },
);

Deno.test(
  "updateVersion() applies minor release for breaking change for pre-major version",
  () => {
    const pkg = {
      directory: "directory",
      module: "name",
      config: { name: "@scope/name", version: "0.2.3" },
    };
    assertEquals(
      calculateVersion(pkg, [{
        hash: "hash",
        author: "author",
        title: "refactor(name)!: message",
        body: "",
        type: "refactor",
        modules: ["name"],
        breaking: true,
      }]),
      "0.3.0",
    );
  },
);
