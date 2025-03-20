import { beforeEach, describe, it } from "@std/testing/bdd";
import { cli, suite, type SuiteContext } from "./suite.ts";
import { createTrack } from "./test_data.ts";

describe(suite, "tracks", function () {
  let s: SuiteContext;

  const cpp = createTrack({
    slug: "cpp",
    is_joined: true,
    num_exercises: 100,
    num_completed_exercises: 100,
  });
  const java = createTrack({
    slug: "java",
    is_joined: true,
    num_exercises: 100,
    num_completed_exercises: 50,
    has_notifications: true,
  });
  const php = createTrack({ slug: "php", is_joined: false });

  beforeEach(function (this: SuiteContext) {
    s = this;
    s.server.tracks(cpp, java, php);
  });

  it("name", async function (t) {
    await cli(s, t, "tracks -e cpp");
  });

  it("name: invalid", async function (t) {
    await cli(s, t, "tracks -e ?cpp");
  });

  it("joined", async function (t) {
    await cli(s, t, "tracks");
  });

  it("completed", async function (t) {
    await cli(s, t, "tracks --completed");
  });

  it("all", async function (t) {
    await cli(s, t, "tracks --all");
  });
});
