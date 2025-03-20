import { beforeEach, describe, it } from "@std/testing/bdd";
import { cli, suite, type SuiteContext } from "./suite.ts";
import { createExercise, createProfile, createTrack } from "./test_data.ts";

describe(suite, "track", function () {
  let s: SuiteContext;

  beforeEach(function (this: SuiteContext) {
    s = this;
  });

  describe("list", function () {
    const profile = createProfile();
    const track = createTrack({
      slug: "typescript",
      title: "TypeScript",
      is_joined: true,
    });

    beforeEach(function () {
      s.server.profile(profile).tracks(track);
    });

    it("name", async function (t) {
      s.server.exercises(
        createExercise({ track, exercise: { slug: "alpha" } }),
        createExercise({ track, exercise: { slug: "beta" } }),
      );
      await cli(s, t, "typescript -e alpha");
      await cli(s, t, "typescript -e beta");
      await cli(s, t, "typescript -e alpha -e beta");
      await cli(s, t, "typescript -e a*");
      await cli(s, t, "typescript -e b*");
      await cli(s, t, "typescript -e c*");
      await cli(s, t, "typescript -e *a");
      await cli(s, t, "typescript -e *e*");
    });

    it("invalid name", async function (t) {
      await cli(s, t, "typescript -e ?alpha");
    });

    it("unlocked", async function (t) {
      s.server.exercises(
        createExercise({
          track,
          exercise: { slug: "unlocked", is_unlocked: true },
        }),
        createExercise({
          track,
          exercise: { slug: "locked", is_unlocked: false },
        }),
      );
      await cli(s, t, "typescript");
      await cli(s, t, "typescript --all");
      await cli(s, t, "typescript --locked");
    });

    it("difficulty", async function (t) {
      s.server.exercises(
        createExercise({
          track,
          exercise: { slug: "easy", difficulty: "easy" },
        }),
        createExercise({
          track,
          exercise: { slug: "medium", difficulty: "medium" },
        }),
        createExercise({
          track,
          exercise: { slug: "hard", difficulty: "hard" },
        }),
      );
      await cli(s, t, "typescript --easy");
      await cli(s, t, "typescript --medium");
      await cli(s, t, "typescript --hard");
    });

    it("status", async function (t) {
      s.server.exercises(
        createExercise({ track, exercise: { slug: "new" } }),
        createExercise({
          track,
          exercise: { slug: "started" },
          solution: { status: "started" },
          iteration: { is_published: false },
        }),
        createExercise({
          track,
          exercise: { slug: "completed" },
          solution: { status: "completed" },
        }),
        createExercise({
          track,
          exercise: { slug: "published" },
          solution: { status: "published" },
          iteration: { is_published: true },
        }),
      );
      await cli(s, t, "typescript --new");
      await cli(s, t, "typescript --started");
      await cli(s, t, "typescript --completed");
      await cli(s, t, "typescript --published");
      await cli(s, t, "typescript --draft");
    });

    it("feedback", async function (t) {
      s.server.exercises(
        createExercise({ track, exercise: { slug: "new" } }),
        createExercise({
          track,
          exercise: { slug: "automated-feedback" },
          solution: { status: "completed" },
          iteration: { num_actionable_automated_comments: 1 },
        }),
        createExercise({
          track,
          exercise: { slug: "human-feedback" },
          solution: { status: "completed" },
          iteration: { num_celebratory_automated_comments: 1 },
        }),
      );
      await cli(s, t, "typescript --feedback");
      await cli(s, t, "typescript -e human-feedback");
    });

    it("outdated", async function (t) {
      s.server.exercises(
        createExercise({ track, exercise: { slug: "new" } }),
        createExercise({
          track,
          exercise: { slug: "outdated" },
          solution: { status: "published", is_out_of_date: true },
          iteration: { is_published: true },
        }),
      );
      await cli(s, t, "typescript --outdated");
    });

    it("test status", async function (t) {
      s.server.exercises(
        createExercise({ track, exercise: { slug: "new" } }),
        createExercise({
          track,
          exercise: { slug: "passing" },
          solution: { status: "completed" },
          iteration: { tests_status: "passed" },
        }),
        createExercise({
          track,
          exercise: { slug: "failing" },
          solution: { status: "completed" },
          iteration: { tests_status: "failed" },
        }),
        createExercise({
          track,
          exercise: { slug: "notQueued" },
          solution: { status: "completed" },
          iteration: { tests_status: "not_queued" },
        }),
      );
      await cli(s, t, "typescript --started");
      await cli(s, t, "typescript --passing");
      await cli(s, t, "typescript --failing");
    });

    it("social", async function (t) {
      s.server.exercises(
        createExercise({ track, exercise: { slug: "new" } }),
        createExercise({
          track,
          exercise: { slug: "starred" },
          solution: { status: "published", num_stars: 2 },
          iteration: { tests_status: "passed" },
        }),
        createExercise({
          track,
          exercise: { slug: "commented" },
          solution: { status: "published", num_comments: 1 },
          iteration: { tests_status: "passed" },
        }),
        createExercise({
          track,
          exercise: { slug: "both" },
          solution: { status: "published", num_stars: 3, num_comments: 2 },
          iteration: { tests_status: "passed" },
        }),
      );
      await cli(s, t, "typescript --starred");
      await cli(s, t, "typescript --commented");
    });

    it("not joined", async function (t) {
      const track = createTrack({ slug: "not-joined", is_joined: false });
      const exercise = createExercise({ track: track });
      s.server.tracks(track).exercises(exercise);
      await cli(s, t, "not-joined");
    });
  });

  describe("subcommand", function () {
    const joinedTrack = createTrack({ slug: "joined", is_joined: true });
    const notJoinedTrack = createTrack({
      slug: "not-joined",
      is_joined: false,
    });
    const unlocked = createExercise({
      track: joinedTrack,
      exercise: { slug: "unlocked", is_unlocked: true },
    });
    const locked = createExercise({
      track: joinedTrack,
      exercise: { slug: "locked", is_unlocked: false },
    });
    const notJoined = createExercise({
      track: notJoinedTrack,
      exercise: { slug: "locked", is_unlocked: false },
    });

    beforeEach(function () {
      s.server
        .tracks(joinedTrack, notJoinedTrack)
        .exercises(unlocked, locked, notJoined)
        .onStart(
          unlocked,
          createExercise({ ...unlocked, solution: { status: "started" } }),
        )
        .onStart(locked, locked);
    });

    it("start", async function (t) {
      await cli(s, t, "joined start --all", { sorted: true });
    });

    it("start: not joined", async function (t) {
      await cli(s, t, "not-joined --all start");
    });

    it("code", async function (t) {
      await cli(s, t, "joined code --all", { sorted: true });
    });

    it("diff", async function (t) {
      await cli(s, t, "joined diff --all", { sorted: true });
    });

    it("download", async function (t) {
      await cli(s, t, "joined download --all", { sorted: true });
    });
  });

  it("deleted track", async function (t) {
    s.server.tracks(createTrack({ slug: "track" }));
    await cli(s, t, "track");
    s.server.reset();
    s.server.tracks();
    await cli(s, t, "track --sync");
  });
});
