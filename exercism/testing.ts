import { assertExists } from "@std/assert/exists";
import { pick } from "@std/collections";
import { toPascalCase } from "@std/text";
import type {
  Client,
  CompletionData,
  ConceptData,
  ConceptProgressionData,
  ExerciseData,
  FileContent,
  FilesData,
  IterationData,
  ReputationData,
  ReputationMeta,
  SolutionData,
  SubmissionData,
  TaskData,
  TestResultData,
  TestRunData,
  TrackData,
  UserData,
} from "./client.ts";

/** Options for the {@link fakeClient} function. */
export interface FakeClientOptions {
  /** Whether to validate or invalidate the authentication token. */
  validate?: boolean;
  /** The user to return from the API. */
  user?: UserData;
  /** The reputation to return from the API. */
  reputation?: ReputationMeta;
  /** The tracks to return from the API. */
  tracks?: TrackData[];
  /** The exercises to return from the API. */
  exercises?: ExerciseData[];
  /** The solutions to return from the API. */
  solutions?: SolutionData[];
  /** The iterations to return from the API. */
  iterations?: IterationData[];
  /** The files to return from the API. */
  files?: FilesData;
  /** The file contents to return from the API. */
  fileContents?: FileContent[];
}

/** Creates a fake Exercism client for testing purposes. */
export function fakeClient(options?: FakeClientOptions): Client {
  let {
    validate,
    user,
    reputation,
    tracks,
    exercises,
    solutions,
    iterations,
    files,
    fileContents,
  } = options ?? {};
  const client: Client = {
    token: {
      async validate() {
        assertExists(validate, "Validate not provided");
        await Promise.resolve();
        return validate;
      },
    },
    user: {
      async get() {
        assertExists(user, "User not provided");
        await Promise.resolve();
        return { user };
      },
      async reputation() {
        assertExists(reputation, "Reputation not provided");
        await Promise.resolve();
        return {
          results: [
            testReputationData({ uuid: "test-reputation-uuid-1" }),
            testReputationData({ uuid: "test-reputation-uuid-2" }),
          ],
          meta: reputation,
        };
      },
    },
    tracks: {
      async list() {
        assertExists(tracks, "Tracks not provided");
        await Promise.resolve();
        return { tracks };
      },
    },
    track: (_) => ({
      exercises: {
        async list() {
          assertExists(exercises, "Exercises not provided");
          await Promise.resolve();
          return { exercises, solutions: solutions ?? [] };
        },
      },
      exercise(slug) {
        return {
          async start() {
            await Promise.resolve();
            const solution = testSolutionData({
              exercise: { slug },
              status: "started",
              num_iterations: 0,
            });
            if (!solutions) solutions = [];
            solutions.push(solution);
            return { solution };
          },
        };
      },
    }),
    solution: (uuid) => ({
      async get() {
        const solution = solutions?.find((solution) => solution.uuid === uuid);
        assertExists(solution, "Solution not provided");
        await Promise.resolve();
        return { solution };
      },
      async complete() {
        const solution = solutions?.find((solution) => solution.uuid === uuid);
        assertExists(solution, "Solution not provided");
        if (solution.status === "iterated") solution.status = "completed";
        await Promise.resolve();
        return testCompletionData();
      },
      async publish() {
        const solution = solutions?.find((solution) => solution.uuid === uuid);
        assertExists(solution, "Solution not provided");
        solution.status = "published";
        await Promise.resolve();
        return { solution };
      },
      async sync() {
        await Promise.resolve();
        return { solution: testSolutionData({ uuid, status: "iterated" }) };
      },
      submissions: {
        async create() {
          await Promise.resolve();
          return { submission: testSubmissionData({ uuid }) };
        },
        async testRun() {
          await Promise.resolve();
          return { test_run: testTestRunData({ uuid }) };
        },
      },
      iterations: {
        async create() {
          const solution = solutions?.find((solution) =>
            solution.uuid === uuid
          );
          assertExists(solution, "Solution not provided");
          if (solution?.status === "started") solution.status = "iterated";
          await Promise.resolve();
          return { iteration: testIterationData({ uuid }) };
        },
        async latest() {
          const iteration = iterations?.find((iteration) =>
            iteration.uuid === uuid
          );
          assertExists(iteration, "Iteration not provided");
          await Promise.resolve();
          return { iteration };
        },
        async publish() {
          const iteration = iterations?.find((iteration) =>
            iteration.uuid === uuid
          );
          assertExists(iteration, "Iteration not provided");
          iteration.is_published = true;
          await Promise.resolve();
          return { iteration };
        },
      },
      files: {
        async list() {
          assertExists(files, "Files not provided");
          await Promise.resolve();
          return { files };
        },
        async submission() {
          assertExists(fileContents, "File contents not provided");
          await Promise.resolve();
          return { files: fileContents };
        },
        async iteration() {
          assertExists(fileContents, "File contents not provided");
          await Promise.resolve();
          return { files: fileContents };
        },
      },
    }),
  };
  return client;
}

/** Creates a dummy {@link UserData} object for testing. */
export function testUserData(data?: Partial<UserData>): UserData {
  return {
    handle: "test-user-handle",
    insiders_status: "ineligible",
    ...data,
  };
}

/** Creates a dummy {@link ReputationData} object for testing. */
export function testReputationData(
  data?: Partial<ReputationData>,
): ReputationData {
  return {
    uuid: "test-reputation-uuid",
    value: 1,
    text: "test-reputation-text",
    icon_url: "test/reputation.svg",
    internal_url: "test/reputation",
    external_url: "test/user/reputation",
    created_at: "2000-01-01T00:00:00Z",
    track: pick(testTrackData(), ["title", "icon_url"]),
    is_seen: false,
    links: {
      mark_as_seen: "test/reputation/mark_as_seen",
    },
    ...data,
  };
}

/** Creates a dummy {@link ReputationMeta} object for testing. */
export function testReputationMeta(
  data?: Partial<ReputationMeta>,
): ReputationMeta {
  return {
    current_page: 1,
    total_count: 123,
    total_pages: 12,
    total_reputation: 42,
    unseen_total: 1,
    links: {
      tokens: "test/reputation/tokens",
      mark_all_as_seen: "test/reputation/mark_all_as_seen",
    },
    ...data,
  };
}

/** Creates a dummy {@link TrackData} object for testing. */
export function testTrackData(data?: Partial<TrackData>): TrackData {
  const { slug = "test-track-slug" } = data ?? {};
  return {
    slug,
    title: toPascalCase(slug),
    course: true,
    num_concepts: 12,
    num_exercises: 42,
    web_url: `test/${slug}`,
    icon_url: `test/${slug}.svg`,
    tags: ["test-tag-1", "test-tag-2"],
    last_touched_at: "2000-01-01T00:00:00Z",
    is_new: false,
    links: {
      self: `test/track/${slug}`,
      exercises: `test/track/${slug}/exercises`,
      concepts: `test/track/${slug}/concepts`,
    },
    ...data,
  };
}

/** Creates a dummy {@link ExerciseData} object for testing. */
export function testExerciseData(data?: Partial<ExerciseData>): ExerciseData {
  const { slug = "test-exercise-slug" } = data ?? {};
  return {
    slug,
    type: "practice",
    title: toPascalCase(slug),
    icon_url: `test/${slug}.svg`,
    difficulty: "easy",
    blurb: "test-exercise-blurb",
    is_external: true,
    is_unlocked: false,
    is_recommended: false,
    links: {
      self: `test/exercise/${slug}`,
    },
    ...data,
  };
}

/** Creates a dummy {@link ConceptData} object for testing. */
export function testConceptData(data?: Partial<ConceptData>): ConceptData {
  const { slug = "test-concept-slug" } = data ?? {};
  return {
    slug,
    name: toPascalCase(slug),
    links: {
      self: `test/concept/${slug}`,
    },
    ...data,
  };
}

/** Creates a dummy {@link TaskData} object for testing. */
export function testTaskData(data?: Partial<TaskData>): TaskData {
  return {
    id: 1,
    title: "test-task-title",
    ...data,
  };
}

/** Creates a dummy {@link SolutionData} object for testing. */
export function testSolutionData(data?: Partial<SolutionData>): SolutionData {
  const { uuid = "test-solution-uuid", status = "started" } = data ?? {};
  const published = status === "published";
  const completed = status === "completed" || published;
  const iterated = status === "iterated" || completed;
  return {
    uuid,
    private_url: `test/solution/${uuid}`,
    public_url: `test/solution/${uuid}/public`,
    status,
    mentoring_status: "none",
    published_iteration_head_tests_status: published ? "passed" : "not_queued",
    has_notifications: false,
    num_views: 0,
    num_stars: 0,
    num_comments: 0,
    num_iterations: iterated ? 1 : 0,
    num_loc: 123,
    is_out_of_date: false,
    published_at: published ? "2000-01-01T00:00:00Z" : null,
    completed_at: completed ? "2000-01-01T00:00:00Z" : null,
    updated_at: "2000-01-01T00:00:00Z",
    last_iterated_at: iterated ? "2000-01-01T00:00:00Z" : null,
    track: pick(testTrackData(), ["slug", "title", "icon_url"]),
    exercise: pick(testExerciseData(), ["slug", "title", "icon_url"]),
    ...data,
  };
}

/** Creates a dummy {@link SubmissionData} object for testing. */
export function testSubmissionData(
  data?: Partial<SubmissionData>,
): SubmissionData {
  const { uuid = "test-submission-uuid" } = data ?? {};
  return {
    uuid,
    tests_status: "passed",
    links: {
      cancel: `test/submission/${uuid}/cancel`,
      submit: `test/submission/${uuid}/submit`,
      test_run: `test/submission/${uuid}/test_run`,
      ai_help: `test/submission/${uuid}/ai_help`,
      initial_files: `test/submission/${uuid}/initial_files`,
      last_iteration_files: `test/submission/${uuid}/last_iteration_files`,
    },
    ...data,
  };
}

/** Creates a dummy {@link TestRunData} object for testing. */
export function testTestRunData(data?: Partial<TestRunData>): TestRunData {
  const { uuid = "test-test-run-uuid" } = data ?? {};
  return {
    uuid,
    submission_uuid: "test-submission-uuid",
    version: 1,
    status: "pass",
    message: null,
    message_html: null,
    output: null,
    output_html: null,
    tasks: [testTaskData({ id: 1 }), testTaskData({ id: 2 })],
    highlightjs_language: "test-highlightjs-language",
    tests: [
      testTestResultData({ task_id: 1 }),
      testTestResultData({ task_id: 2 }),
    ],
    links: {
      self: `test/test_run/${uuid}`,
    },
    ...data,
  };
}

/** Creates a dummy {@link TestResultData} object for testing. */
export function testTestResultData(
  data?: Partial<TestResultData>,
): TestResultData {
  return {
    name: "test-test-result-name",
    status: "pass",
    test_code: "test-test-result-test-code",
    message: "test-test-result-message",
    message_html: "test-test-result-message-html",
    expected: "test-test-result-expected",
    output: "test-test-result-output",
    output_html: "test-test-result-output-html",
    task_id: null,
    ...data,
  };
}

/** Creates a dummy {@link CompletionData} object for testing. */
export function testCompletionData(
  data?: Partial<CompletionData>,
): CompletionData {
  return {
    track: testTrackData(),
    exercise: testExerciseData(),
    unlocked_exercises: [testExerciseData({ slug: "unlocked" })],
    unlocked_concepts: [testConceptData({ slug: "unlocked" })],
    concept_progressions: [testConceptProgressionData({ slug: "progressed" })],
    ...data,
  };
}

/** Creates a dummy {@link ConceptProgressionData} object for testing. */
export function testConceptProgressionData(
  data?: Partial<ConceptProgressionData>,
): ConceptProgressionData {
  const { slug = "test-concept-slug" } = data ?? {};
  return {
    slug,
    name: toPascalCase(slug),
    from: 0,
    to: 1,
    total: 2,
    links: {
      self: `test/concept/${slug}`,
    },
    ...data,
  };
}

/** Creates a dummy {@link IterationData} object for testing. */
export function testIterationData(
  data?: Partial<IterationData>,
): IterationData {
  const { uuid = "test-solution-uuid" } = data ?? {};
  return {
    uuid,
    submission_uuid: "test-submission-uuid",
    idx: 1,
    status: null,
    num_essential_automated_comments: 0,
    num_actionable_automated_comments: 0,
    num_non_actionable_automated_comments: 0,
    num_celebratory_automated_comments: 0,
    submission_method: "api",
    created_at: "2000-01-01T00:00:00Z",
    tests_status: "passed",
    is_published: false,
    is_latest: true,
    links: {
      self: `test/iteration/${uuid}/iteration`,
      automated_feedback: `test/iteration/${uuid}/automated_feedback`,
      delete: `test/iteration/${uuid}/delete`,
      solution: `test/iteration/${uuid}`,
      test_run: `test/iteration/${uuid}/test_run`,
      files: `test/iteration/${uuid}/files`,
    },
    ...data,
  };
}

/** Creates a dummy {@link FilesData} object for testing. */
export function testFilesData(data?: Partial<FilesData>): FilesData {
  return {
    solution: ["test-solution-file.ts"],
    test: ["test-test-file.ts"],
    example: [".meta/test-example-file.ts"],
    ...data,
  };
}

/** Creates a dummy {@link FileContent} object for testing. */
export function testFileContent(data?: Partial<FileContent>): FileContent {
  return {
    filename: "test-filename.ts",
    content: "test-content",
    type: "solution",
    ...data,
  };
}
