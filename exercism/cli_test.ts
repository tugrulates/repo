import { beforeEach, describe, it } from "@std/testing/bdd";
import { cli, suite, type SuiteContext } from "./suite.ts";
import { createExercise, createProfile, createTrack } from "./test_data.ts";

describe(suite, "cli", function () {
  let s: SuiteContext;

  const profile = createProfile();
  const python = createTrack({ slug: "python", is_joined: false });
  const rust = createTrack({ slug: "rust", is_joined: true });
  const typescript = createTrack({ slug: "typescript", is_joined: true });
  const bob = { exercise: { slug: "bob" } };

  beforeEach(function (this: SuiteContext) {
    s = this;
    s.server
      .profile(profile)
      .tracks(python, rust, typescript)
      .exercises(
        createExercise({ track: python, ...bob }),
        createExercise({ track: rust, ...bob }),
        createExercise({ track: typescript, ...bob }),
      );
  });

  it("bare", async function (t) {
    await cli(s, t, "");
  });

  it("--quiet", async function (t) {
    await cli(s, t, "--quiet");
  });

  it("--verbose", async function (t) {
    await cli(s, t, "--verbose", { sorted: true });
  });

  it("--json", async function (t) {
    await cli(s, t, "--json");
    await cli(s, t, "profile --json");
    await cli(s, t, "tracks --json");
    await cli(s, t, "tracks --all --json");
    await cli(s, t, "typescript --json");
    await cli(s, t, "typescript bob --json");
  });

  it("--sync", async function (t) {
    await cli(s, t, "--sync");
    await cli(s, t, "profile --sync");
    await cli(s, t, "tracks --sync");
    await cli(s, t, "tracks --all --sync");
    await cli(s, t, "typescript --sync");
    await cli(s, t, "typescript bob --sync");
  });

  it("--sync --quiet", async function (t) {
    await cli(s, t, "--sync --quiet");
  });

  it("--sync --json", async function (t) {
    await cli(s, t, "--sync --json");
  });

  it("--open", async function (t) {
    await cli(s, t, "--open");
    await cli(s, t, "profile --open");
    await cli(s, t, "tracks --open", { sorted: true });
    await cli(s, t, "tracks --all --open", { sorted: true });
    await cli(s, t, "typescript --open", { sorted: true });
    await cli(s, t, "typescript bob --open");
    await cli(s, t, "typescript -e bob --open");
  });

  it("help", async function (t) {
    await cli(s, t, "--help");
    await cli(s, t, "profile --help");
    await cli(s, t, "tracks --help");
    await cli(s, t, "git --help");
    await cli(s, t, "typescript --help");
    await cli(s, t, "typescript bob --help");
    await cli(s, t, "typescript bob start --help");
    await cli(s, t, "typescript bob code --help");
    await cli(s, t, "typescript bob format --help");
    await cli(s, t, "typescript bob lint --help");
    await cli(s, t, "typescript bob test --help");
    await cli(s, t, "typescript bob diff --help");
    await cli(s, t, "typescript bob download --help");
    await cli(s, t, "typescript bob submit --help");
    await cli(s, t, "typescript bob complete --help");
    await cli(s, t, "typescript bob publish --help");
    await cli(s, t, "typescript bob update --help");
  });

  it("invalid", async function (t) {
    await cli(s, t, "--unknown");
    await cli(s, t, "unknown");
    await cli(s, t, "profile unknown");
    await cli(s, t, "tracks unknown");
    await cli(s, t, "git unknown");
    await cli(s, t, "typescript unknown");
    await cli(s, t, "typescript bob unknown");
    await cli(s, t, "typescript bob start unknown");
    await cli(s, t, "typescript bob code unknown");
    await cli(s, t, "typescript bob format unknown");
    await cli(s, t, "typescript bob lint unknown");
    await cli(s, t, "typescript bob test unknown");
    await cli(s, t, "typescript bob diff unknown");
    await cli(s, t, "typescript bob download unknown");
    await cli(s, t, "typescript bob submit unknown");
    await cli(s, t, "typescript bob complete unknown");
    await cli(s, t, "typescript bob publish unknown");
    await cli(s, t, "typescript bob update unknown");
  });
});
