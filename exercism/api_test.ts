import { beforeEach, describe, it } from "@std/testing/bdd";
import { methods } from "./api.ts";
import { NOT_FOUND, TOKEN, TOO_MANY_REQUESTS } from "./mock_server.ts";
import { cli, suite, type SuiteContext } from "./suite.ts";
import { createExercise, createProfile, createTrack } from "./test_data.ts";

describe(suite, "cli", function () {
  let s: SuiteContext;

  const profile = createProfile();
  const track = createTrack({ slug: "track", is_joined: true });
  const exercise = createExercise({
    track,
    exercise: { slug: "exercise" },
    solution: { status: "iterated" },
  });

  beforeEach(function (this: SuiteContext) {
    s = this;
    s.server.profile(profile).tracks(track).exercises(exercise);
  });

  it("token: prompt", async function (t) {
    await cli(s, t, "profile", { prompt: TOKEN, token: null });
  });

  it("token: prompt invalid", async function (t) {
    await cli(s, t, "profile", { prompt: "invalid", token: null });
  });

  it("token: prompt missing", async function (t) {
    await cli(s, t, "profile", { token: null });
  });

  it("token: config invalid", async function (t) {
    await cli(s, t, "profile", { token: "invalid" });
  });

  it("request: not found", async function (t) {
    s.server.respond(methods.user, NOT_FOUND);
    await cli(s, t, "profile");
  });

  it("request: too many requests", async function (t) {
    s.server.respond(methods.user, TOO_MANY_REQUESTS);
    await cli(s, t, "profile");
  });

  it("request: too many requests retry", async function (t) {
    s.server.respond(methods.user, TOO_MANY_REQUESTS, { times: 1 });
    await cli(s, t, "profile");
  });
});
