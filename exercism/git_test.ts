import { ensureFile } from "@std/fs";
import { join, toFileUrl } from "@std/path";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSnapshot } from "@std/testing/snapshot";
import { GitClient } from "./git.ts";
import { assertFiles, cli, prune, suite, type SuiteContext } from "./suite.ts";
import { createExercise, createProfile, createTrack } from "./test_data.ts";

describe(suite, "git", function () {
  let s: SuiteContext;

  let repoDirectory: string;
  let repoUrl: string;
  let git: GitClient;
  const profile = createProfile();
  const java = createTrack({
    slug: "java",
    is_joined: true,
    num_exercises: 3,
    num_completed_exercises: 0,
  });
  const python = createTrack({
    slug: "python",
    is_joined: false,
    num_exercises: 3,
    num_completed_exercises: 0,
  });
  const rust = createTrack({
    slug: "rust",
    is_joined: true,
    num_exercises: 3,
    num_completed_exercises: 2,
  });
  const typescript = createTrack({
    slug: "typescript",
    is_joined: true,
    num_exercises: 3,
    num_completed_exercises: 3,
  });
  const bob = {
    exercise: { slug: "bob" },
    solution: { status: "published" as const },
  };
  const pov = {
    exercise: { slug: "pov" },
    solution: { status: "started" as const },
  };
  const etl = {
    exercise: { slug: "etl" },
    solution: { status: "started" as const },
  };

  beforeEach(async function (this: SuiteContext) {
    s = this;
    repoDirectory = await Deno.makeTempDir();
    repoUrl = toFileUrl(repoDirectory).href;
    git = new GitClient({ cwd: repoDirectory });
    await git.init();
    await ensureFile(join(repoDirectory, ".gitignore"));
    git.add(".gitignore");
    await git.config("receive.denyCurrentBranch", "ignore");
    await git.commit("Initial commit");
    this.server
      .profile(profile)
      .tracks(python, rust, typescript)
      .exercises(
        createExercise({ track: python, ...bob }),
        createExercise({ track: rust, ...bob }),
        createExercise({ track: typescript, ...bob }),
        createExercise({ track: typescript, ...pov }),
      );
  });

  afterEach(async function () {
    await Deno.remove(repoDirectory, { recursive: true });
  });

  async function assertRepo(
    t: Deno.TestContext,
  ): Promise<void> {
    await git.reset();
    await assertSnapshot(
      t,
      (await git.log()).map((line) => prune(line, { hash: true })),
    );
    await assertFiles(s, t, repoDirectory);
  }

  it("git: dry-run", async function (t) {
    await cli(s, t, `git --dry-run --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: push", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: no changes", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: remove track", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    s.server.tracks(rust);
    await cli(s, t, `tracks --sync --all`);
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: add track", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    s.server
      .tracks(java, python, rust, typescript)
      .exercises(createExercise({ track: java, ...bob }));
    await cli(s, t, `tracks --sync --all`);
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: add and remove tracks", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    s.server
      .tracks(java)
      .exercises(createExercise({ track: java, ...bob }));
    await cli(s, t, `tracks --sync --all`);
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: add exercise", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    s.server.exercises(
      createExercise({ track: typescript, ...bob }),
      createExercise({ track: typescript, ...pov }),
      createExercise({ track: typescript, ...etl }),
    );
    await cli(s, t, `typescript --sync`);
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: remove exercise", async function (t) {
    await cli(s, t, `git --repo=${repoUrl}`);
    s.server
      .exercises(createExercise({ track: typescript, ...bob }));
    await cli(s, t, `typescript --sync`);
    await cli(s, t, `git --repo=${repoUrl}`);
    await assertRepo(t);
  });

  it("git: prompt repo", async function (t) {
    await cli(s, t, `git`, { prompt: repoUrl });
    await assertRepo(t);
  });

  it("git: invalid repo", async function (t) {
    await cli(s, t, `git`, { prompt: "invalid" });
    await assertRepo(t);
  });

  it("git: branch", async function (t) {
    await cli(s, t, `git --repo=${repoUrl} --branch=main`);
    await assertRepo(t);
  });

  it("git: wrong branch", async function (t) {
    await cli(s, t, `git --repo=${repoUrl} --branch=feature`);
    await assertRepo(t);
  });

  it("git: remember repo", async function (t) {
    await cli(s, t, `git --repo=${repoUrl} --dry-run`);
    await cli(s, t, `git`);
    await assertRepo(t);
  });
});
