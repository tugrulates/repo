import { assertArrayObjectMatch } from "@roka/assert";
import { tempDirectory } from "@roka/testing/temp";
import { assertEquals, assertExists, assertObjectMatch } from "@std/assert";
import { exercism } from "./exercism.ts";
import {
  fakeClient,
  testExerciseData,
  testIterationData,
  testReputationMeta,
  testSolutionData,
  testTrackData,
  testUserData,
} from "./testing.ts";

Deno.test("exercism() uses current directory as workspace", () => {
  const manager = exercism();
  assertEquals(manager.workspace, Deno.cwd());
});

Deno.test("exercism() can use different directory as workspace", () => {
  const manager = exercism({ workspace: "workspace" });
  assertEquals(manager.workspace, "workspace");
});

Deno.test("exercism().authenticated() reports valid token", async () => {
  const manager = exercism({ client: fakeClient({ validate: true }) });
  assertEquals(await manager.authenticated(), true);
});

Deno.test("exercism().authenticated() reports invalid token", async () => {
  const manager = exercism({ client: fakeClient({ validate: false }) });
  assertEquals(await manager.authenticated(), false);
});

Deno.test("exercism().profile() provides logged in profile", async () => {
  const manager = exercism({
    client: fakeClient({
      user: testUserData({ handle: "handle" }),
      reputation: testReputationMeta({ total_reputation: 42 }),
    }),
  });
  assertObjectMatch(await manager.profile(), {
    handle: "handle",
    reputation: 42,
  });
});

Deno.test("exercism().tracks() provides all tracks", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [
        testTrackData({ slug: "track-1", is_joined: true }),
        testTrackData({ slug: "track-2", is_joined: false }),
        testTrackData({ slug: "track-3", is_joined: true }),
      ],
    }),
  });
  assertArrayObjectMatch(await manager.tracks(), [
    { slug: "track-1" },
    { slug: "track-2" },
    { slug: "track-3" },
  ]);
});

Deno.test("exercism().tracks() can provide named tracks", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [
        testTrackData({ slug: "track-1" }),
        testTrackData({ slug: "track-2" }),
        testTrackData({ slug: "track-3" }),
      ],
    }),
  });
  assertArrayObjectMatch(
    await manager.tracks({ track: ["track-2", "track-3"] }),
    [
      { slug: "track-2" },
      { slug: "track-3" },
    ],
  );
  assertArrayObjectMatch(await manager.tracks({ track: ["t*1"] }), [
    { slug: "track-1" },
  ]);
  assertArrayObjectMatch(await manager.tracks({ track: ["t*k-?"] }), [
    { slug: "track-1" },
    { slug: "track-2" },
    { slug: "track-3" },
  ]);
});

Deno.test("exercism().tracks() can provide joined tracks", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [
        testTrackData({ slug: "track-joined", is_joined: true }),
        testTrackData({ slug: "track-not-joined", is_joined: false }),
      ],
    }),
  });
  assertArrayObjectMatch(await manager.tracks({ joined: true }), [
    { slug: "track-joined", joined: true },
  ]);
  assertArrayObjectMatch(await manager.tracks({ joined: false }), [
    { slug: "track-not-joined", joined: false },
  ]);
});

Deno.test("exercism().tracks() sorts by completion", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [
        testTrackData({
          slug: "track-completed-2",
          is_joined: true,
          num_exercises: 4,
          num_completed_exercises: 3,
        }),
        testTrackData({
          slug: "track-completed-4",
          is_joined: true,
          num_exercises: 4,
          num_completed_exercises: 4,
        }),
        testTrackData({
          slug: "track-completed-0",
          is_joined: true,
          num_exercises: 4,
          num_completed_exercises: 0,
        }),
      ],
    }),
  });
  assertArrayObjectMatch(await manager.tracks(), [
    { slug: "track-completed-4" },
    { slug: "track-completed-2" },
    { slug: "track-completed-0" },
  ]);
});

Deno.test("exercism().track() provides track data", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [
        testTrackData({
          slug: "track",
          title: "track-title",
          is_joined: true,
          num_exercises: 2,
          num_completed_exercises: 1,
          web_url: "track-url",
          has_notifications: true,
          links: { self: "track-url" },
        }),
      ],
    }),
  });
  assertObjectMatch(await manager.track("track"), {
    slug: "track",
    url: "track-url",
    title: "track-title",
    joined: true,
    completed: false,
    numExercises: 2,
    numCompleted: 1,
    hasNotifications: true,
  });
});

Deno.test("track.exercises() provides all exercises", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-1", is_unlocked: true }),
        testExerciseData({ slug: "exercise-2", is_unlocked: false }),
        testExerciseData({ slug: "exercise-3", is_unlocked: true }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(await track.exercises(), [
    { slug: "exercise-1" },
    { slug: "exercise-2" },
    { slug: "exercise-3" },
  ]);
});

Deno.test("track.exercises() can provide named exercises", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-1" }),
        testExerciseData({ slug: "exercise-2" }),
        testExerciseData({ slug: "exercise-3" }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(
    await track.exercises({ exercise: ["exercise-2", "exercise-3"] }),
    [
      { slug: "exercise-2" },
      { slug: "exercise-3" },
    ],
  );
  assertArrayObjectMatch(await track.exercises({ exercise: ["e*1"] }), [
    { slug: "exercise-1" },
  ]);
  assertArrayObjectMatch(await track.exercises({ exercise: ["e*e-?"] }), [
    { slug: "exercise-1" },
    { slug: "exercise-2" },
    { slug: "exercise-3" },
  ]);
});

Deno.test("track.exercises() can provide unlocked exercises", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-unlocked", is_unlocked: true }),
        testExerciseData({ slug: "exercise-locked", is_unlocked: false }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(await track.exercises({ unlocked: true }), [
    { slug: "exercise-unlocked", unlocked: true },
  ]);
  assertArrayObjectMatch(await track.exercises({ unlocked: false }), [
    { slug: "exercise-locked", unlocked: false },
  ]);
});

Deno.test("track.exercises() can provide exercises based on difficulty", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-easy", difficulty: "easy" }),
        testExerciseData({ slug: "exercise-medium", difficulty: "medium" }),
        testExerciseData({ slug: "exercise-hard", difficulty: "hard" }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(await track.exercises({ easy: true }), [
    { slug: "exercise-easy", difficulty: "easy" },
  ]);
  assertArrayObjectMatch(await track.exercises({ easy: false }), [
    { slug: "exercise-medium", difficulty: "medium" },
    { slug: "exercise-hard", difficulty: "hard" },
  ]);
  assertArrayObjectMatch(await track.exercises({ medium: true }), [
    { slug: "exercise-medium", difficulty: "medium" },
  ]);
  assertArrayObjectMatch(await track.exercises({ medium: false }), [
    { slug: "exercise-easy", difficulty: "easy" },
    { slug: "exercise-hard", difficulty: "hard" },
  ]);
  assertArrayObjectMatch(await track.exercises({ hard: true }), [
    { slug: "exercise-hard", difficulty: "hard" },
  ]);
  assertArrayObjectMatch(await track.exercises({ hard: false }), [
    { slug: "exercise-easy", difficulty: "easy" },
    { slug: "exercise-medium", difficulty: "medium" },
  ]);
});

Deno.test("track.exercises() can provide exercises based on state", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-locked", is_unlocked: false }),
        testExerciseData({ slug: "exercise-new", is_unlocked: true }),
        testExerciseData({ slug: "exercise-started", is_unlocked: true }),
        testExerciseData({ slug: "exercise-iterated", is_unlocked: true }),
        testExerciseData({ slug: "exercise-completed", is_unlocked: true }),
        testExerciseData({ slug: "exercise-published", is_unlocked: true }),
        testExerciseData({ slug: "exercise-outdated", is_unlocked: true }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise-started" },
          uuid: "solution-started",
          status: "started",
          num_iterations: 0,
        }),
        testSolutionData({
          exercise: { slug: "exercise-iterated" },
          uuid: "solution-iterated",
          status: "iterated",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-completed" },
          uuid: "solution-completed",
          status: "completed",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-published" },
          uuid: "solution-published",
          status: "published",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-outdated" },
          uuid: "solution-outdated",
          status: "published",
          num_iterations: 1,
          is_out_of_date: true,
        }),
      ],
      files: {
        solution: ["file-solution"],
        test: ["file-test"],
        example: ["file-example"],
      },
      iterations: [
        testIterationData({ uuid: "solution-iterated", is_published: false }),
        testIterationData({ uuid: "solution-completed", is_published: false }),
        testIterationData({ uuid: "solution-published", is_published: true }),
        testIterationData({ uuid: "solution-outdated", is_published: true }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(await track.exercises({ unlocked: false }), [
    { slug: "exercise-locked" },
  ]);
  assertArrayObjectMatch(await track.exercises({ unlocked: true }), [
    { slug: "exercise-new" },
    { slug: "exercise-started" },
    { slug: "exercise-iterated" },
    { slug: "exercise-completed" },
    { slug: "exercise-published" },
    { slug: "exercise-outdated" },
  ]);
  assertArrayObjectMatch(await track.exercises({ started: false }), [
    { slug: "exercise-locked" },
    { slug: "exercise-new" },
  ]);
  assertArrayObjectMatch(await track.exercises({ started: true }), [
    { slug: "exercise-started" },
    { slug: "exercise-iterated" },
    { slug: "exercise-completed" },
    { slug: "exercise-published" },
    { slug: "exercise-outdated" },
  ]);
  assertArrayObjectMatch(await track.exercises({ iterated: false }), [
    { slug: "exercise-locked" },
    { slug: "exercise-new" },
    { slug: "exercise-started" },
  ]);
  assertArrayObjectMatch(await track.exercises({ iterated: true }), [
    { slug: "exercise-iterated" },
    { slug: "exercise-completed" },
    { slug: "exercise-published" },
    { slug: "exercise-outdated" },
  ]);
  assertArrayObjectMatch(await track.exercises({ completed: false }), [
    { slug: "exercise-locked" },
    { slug: "exercise-new" },
    { slug: "exercise-started" },
    { slug: "exercise-iterated" },
  ]);
  assertArrayObjectMatch(await track.exercises({ completed: true }), [
    { slug: "exercise-completed" },
    { slug: "exercise-published" },
    { slug: "exercise-outdated" },
  ]);
  assertArrayObjectMatch(await track.exercises({ published: false }), [
    { slug: "exercise-locked" },
    { slug: "exercise-new" },
    { slug: "exercise-started" },
    { slug: "exercise-iterated" },
    { slug: "exercise-completed" },
  ]);
  assertArrayObjectMatch(await track.exercises({ published: true }), [
    { slug: "exercise-published" },
    { slug: "exercise-outdated" },
  ]);
  assertArrayObjectMatch(await track.exercises({ outdated: false }), [
    { slug: "exercise-locked" },
    { slug: "exercise-new" },
    { slug: "exercise-started" },
    { slug: "exercise-iterated" },
    { slug: "exercise-completed" },
    { slug: "exercise-published" },
  ]);
  assertArrayObjectMatch(await track.exercises({ outdated: true }), [
    { slug: "exercise-outdated" },
  ]);
});

Deno.test("track.exercises() can provide exercises based on test status", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-no-tests" }),
        testExerciseData({ slug: "exercise-failing" }),
        testExerciseData({ slug: "exercise-exceptioned" }),
        testExerciseData({ slug: "exercise-passing" }),
        testExerciseData({ slug: "exercise-not-queued" }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise-no-tests" },
          uuid: "solution-no-tests",
          status: "started",
          num_iterations: 0,
        }),
        testSolutionData({
          exercise: { slug: "exercise-failing" },
          uuid: "solution-failing",
          status: "iterated",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-exceptioned" },
          uuid: "solution-exceptioned",
          status: "iterated",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-passing" },
          uuid: "solution-passing",
          status: "iterated",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-not-queued" },
          uuid: "solution-not-queued",
          status: "iterated",
          num_iterations: 1,
        }),
      ],
      files: {
        solution: ["file-solution"],
        test: ["file-test"],
        example: ["file-example"],
      },
      iterations: [
        testIterationData({
          uuid: "solution-failing",
          status: "tests_failed",
          tests_status: "failed",
        }),
        testIterationData({
          uuid: "solution-exceptioned",
          status: "tests_failed",
          tests_status: "exceptioned",
        }),
        testIterationData({
          uuid: "solution-passing",
          status: "no_automated_feedback",
          tests_status: "passed",
        }),
        testIterationData({
          uuid: "solution-not-queued",
          status: "untested",
          tests_status: "queued",
        }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(await track.exercises({ passing: false }), [
    { slug: "exercise-no-tests" },
    { slug: "exercise-failing" },
    { slug: "exercise-exceptioned" },
    { slug: "exercise-not-queued" },
  ]);
  assertArrayObjectMatch(await track.exercises({ passing: true }), [
    { slug: "exercise-passing" },
  ]);
  assertArrayObjectMatch(await track.exercises({ failing: false }), [
    { slug: "exercise-no-tests" },
    { slug: "exercise-passing" },
    { slug: "exercise-not-queued" },
  ]);
  assertArrayObjectMatch(await track.exercises({ failing: true }), [
    { slug: "exercise-failing" },
    { slug: "exercise-exceptioned" },
  ]);
});

Deno.test("track.exercises() can provide exercises based on feedback", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track" })],
      exercises: [
        testExerciseData({ slug: "exercise-automated-feedback" }),
        testExerciseData({ slug: "exercise-human-feedback" }),
        testExerciseData({ slug: "exercise-starred" }),
        testExerciseData({ slug: "exercise-commented" }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise-automated-feedback" },
          uuid: "solution-automated-feedback",
          status: "published",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-human-feedback" },
          uuid: "solution-human-feedback",
          status: "published",
          num_iterations: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-starred" },
          uuid: "solution-starred",
          status: "published",
          num_iterations: 1,
          num_stars: 1,
        }),
        testSolutionData({
          exercise: { slug: "exercise-commented" },
          uuid: "solution-commented",
          status: "published",
          num_iterations: 1,
          num_comments: 1,
        }),
      ],
      files: {
        solution: ["file-solution"],
        test: ["file-test"],
        example: ["file-example"],
      },
      iterations: [
        testIterationData({
          uuid: "solution-automated-feedback",
          status: "actionable_automated_feedback",
          num_actionable_automated_comments: 1,
        }),
        testIterationData({
          uuid: "solution-human-feedback",
          status: "celebratory_automated_feedback",
          num_celebratory_automated_comments: 1,
        }),
        testIterationData({
          uuid: "solution-starred",
          status: "no_automated_feedback",
        }),
        testIterationData({
          uuid: "solution-commented",
          status: "no_automated_feedback",
        }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertArrayObjectMatch(await track.exercises({ feedback: false }), [
    { slug: "exercise-human-feedback" },
    { slug: "exercise-starred" },
    { slug: "exercise-commented" },
  ]);
  assertArrayObjectMatch(await track.exercises({ feedback: true }), [
    { slug: "exercise-automated-feedback" },
  ]);
  assertArrayObjectMatch(await track.exercises({ starred: false }), [
    { slug: "exercise-automated-feedback" },
    { slug: "exercise-human-feedback" },
    { slug: "exercise-commented" },
  ]);
  assertArrayObjectMatch(await track.exercises({ starred: true }), [
    { slug: "exercise-starred" },
  ]);
  assertArrayObjectMatch(await track.exercises({ commented: false }), [
    { slug: "exercise-automated-feedback" },
    { slug: "exercise-human-feedback" },
    { slug: "exercise-starred" },
  ]);
  assertArrayObjectMatch(await track.exercises({ commented: true }), [
    { slug: "exercise-commented" },
  ]);
});

Deno.test("track.exercise() can provide exercise data with no solution", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [testTrackData({ slug: "track", is_joined: true })],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          title: "exercise-title",
          blurb: "exercise-blurb",
          is_unlocked: true,
        }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertObjectMatch(await track.exercise("exercise"), {
    slug: "exercise",
    track: { slug: "track" },
    difficulty: "medium",
    title: "exercise-title",
    blurb: "exercise-blurb",
    unlocked: true,
    solution: null,
  });
});

Deno.test("track.exercise() provides exercise data with solution", async () => {
  const manager = exercism({
    client: fakeClient({
      tracks: [
        testTrackData({
          slug: "track",
          title: "track-title",
          is_joined: true,
          num_exercises: 2,
          num_completed_exercises: 1,
          web_url: "track-url",
          has_notifications: true,
          links: { self: "track-url" },
        }),
      ],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          title: "exercise-title",
          blurb: "exercise-blurb",
          is_unlocked: true,
        }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise" },
          uuid: "solution",
          status: "published",
          num_iterations: 1,
          num_stars: 23,
          num_comments: 12,
          is_out_of_date: true,
        }),
      ],
      files: {
        solution: ["file-solution"],
        test: ["file-test"],
        example: ["file-example"],
        editor: ["file-editor"],
        invalidator: ["file-invalidator"],
      },
      iterations: [
        testIterationData({
          uuid: "solution",
          is_published: true,
          status: "no_automated_feedback",
          tests_status: "passed",
          num_actionable_automated_comments: 1,
          num_celebratory_automated_comments: 1,
          num_essential_automated_comments: 1,
          num_non_actionable_automated_comments: 1,
        }),
      ],
    }),
  });
  const track = await manager.track("track");
  assertObjectMatch(await track.exercise("exercise"), {
    slug: "exercise",
    track: {
      slug: "track",
      url: "track-url",
      title: "track-title",
      joined: true,
      completed: false,
      numExercises: 2,
      numCompleted: 1,
      hasNotifications: true,
    },
    difficulty: "medium",
    title: "exercise-title",
    blurb: "exercise-blurb",
    unlocked: true,
    solution: {
      uuid: "solution",
      files: {
        solution: ["file-solution"],
        test: ["file-test"],
        example: ["file-example"],
        editor: ["file-editor"],
        invalidator: ["file-invalidator"],
      },
      iterated: true,
      completed: true,
      published: true,
      outdated: true,
      passing: true,
      failing: false,
      hasAutomatedFeedback: true,
      hasHumanFeedback: true,
      stars: 23,
      comments: 12,
    },
  });
});

Deno.test("exercise.start() starts and downloads exercise", async () => {
  await using directory = await tempDirectory();
  const manager = exercism({
    workspace: directory.path(),
    client: fakeClient({
      tracks: [testTrackData({ slug: "track", is_joined: true })],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          title: "exercise-title",
          blurb: "exercise-blurb",
          is_unlocked: true,
        }),
      ],
      files: { solution: ["solution"], test: ["test"], example: [] },
      fileContents: [
        { filename: "solution", content: "solution content" },
        { filename: "test", content: "test content" },
      ],
    }),
  });
  const track = await manager.track("track");
  const exercise = await track.exercise("exercise");
  const solution = await exercise.start();
  assertObjectMatch(solution, { iterated: false });
  assertEquals(solution, exercise.solution);
  assertEquals(
    await Deno.readTextFile(directory.path("track/exercise/solution")),
    "solution content",
  );
  assertEquals(
    await Deno.readTextFile(directory.path("track/exercise/test")),
    "test content",
  );
});

Deno.test("solution.download() downloads a solution", async () => {
  await using directory = await tempDirectory();
  const manager = exercism({
    workspace: directory.path(),
    client: fakeClient({
      tracks: [testTrackData({ slug: "track", is_joined: true })],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          is_unlocked: true,
        }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise" },
        }),
      ],
      files: { solution: ["solution"], test: ["test"], example: [] },
      fileContents: [
        { filename: "solution", content: "solution content" },
        { filename: "test", content: "test content" },
      ],
    }),
  });
  const track = await manager.track("track");
  const exercise = await track.exercise("exercise");
  const solution = exercise.solution;
  assertExists(solution);
  assertEquals(await solution.downloaded(), false);
  assertEquals(await solution.download(), true);
  assertEquals(await solution.downloaded(), true);
  assertEquals(
    await Deno.readTextFile(directory.path("track/exercise/solution")),
    "solution content",
  );
  assertEquals(
    await Deno.readTextFile(directory.path("track/exercise/test")),
    "test content",
  );
});

Deno.test("solution.submit() submits a solution", async () => {
  await using directory = await tempDirectory();
  await Deno.mkdir(directory.path("track/exercise"), { recursive: true });
  await Deno.writeTextFile(
    directory.path("track/exercise/solution"),
    "solution content",
  );
  await Deno.writeTextFile(
    directory.path("track/exercise/test"),
    "test content",
  );
  const manager = exercism({
    workspace: directory.path(),
    client: fakeClient({
      tracks: [testTrackData({ slug: "track", is_joined: true })],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          is_unlocked: true,
        }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise" },
          uuid: "solution-uuid",
          status: "started",
          num_iterations: 0,
        }),
      ],
      iterations: [
        testIterationData({ uuid: "solution-uuid", is_published: false }),
      ],
      files: { solution: ["solution"], test: ["test"], example: [] },
    }),
  });
  const track = await manager.track("track");
  const exercise = await track.exercise("exercise");
  const solution = exercise.solution;
  assertExists(solution);
  assertEquals(solution.iterated, false);
  assertEquals(await solution.submit({ force: false }), true);
  assertEquals(solution.iterated, true);
});

Deno.test("solution.complete() completes a solution", async () => {
  await using directory = await tempDirectory();
  const manager = exercism({
    workspace: directory.path(),
    client: fakeClient({
      tracks: [testTrackData({ slug: "track", is_joined: true })],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          is_unlocked: true,
        }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise" },
          uuid: "solution-uuid",
          status: "iterated",
          num_iterations: 0,
        }),
      ],
      iterations: [
        testIterationData({ uuid: "solution-uuid", is_published: false }),
      ],
      files: { solution: ["solution"], test: ["test"], example: [] },
      fileContents: [
        { filename: "solution", content: "solution content" },
        { filename: "test", content: "test content" },
      ],
    }),
  });
  const track = await manager.track("track");
  const exercise = await track.exercise("exercise");
  const solution = exercise.solution;
  assertExists(solution);
  assertEquals(solution.completed, false);
  assertEquals(await solution.complete(), true);
  assertEquals(solution.completed, true);
});

Deno.test("solution.publish() publishes a solution", async () => {
  await using directory = await tempDirectory();
  const manager = exercism({
    workspace: directory.path(),
    client: fakeClient({
      tracks: [testTrackData({ slug: "track", is_joined: true })],
      exercises: [
        testExerciseData({
          slug: "exercise",
          difficulty: "medium",
          is_unlocked: true,
        }),
      ],
      solutions: [
        testSolutionData({
          exercise: { slug: "exercise" },
          uuid: "solution-uuid",
          status: "completed",
          num_iterations: 0,
        }),
      ],
      iterations: [
        testIterationData({ uuid: "solution-uuid", is_published: false }),
      ],
      files: { solution: ["solution"], test: ["test"], example: [] },
      fileContents: [
        { filename: "solution", content: "solution content" },
        { filename: "test", content: "test content" },
      ],
    }),
  });
  const track = await manager.track("track");
  const exercise = await track.exercise("exercise");
  const solution = exercise.solution;
  assertExists(solution);
  assertEquals(solution.published, false);
  assertEquals(await solution.publish(), true);
  assertEquals(solution.published, true);
});
