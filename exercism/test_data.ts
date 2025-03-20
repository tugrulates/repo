import { toPascalCase } from "@std/text";
import type {
  CompletionData,
  ExerciseData,
  FileContent,
  IterationData,
  ProfileData,
  SolutionData,
  SubmissionData,
  SubmissionTestStatus,
  TestRunData,
  TestRunStatus,
  TrackData,
} from "./data.ts";

const TEST_HANDLE = "test-handle";
const TEST_TRACK = "test-track";
const TEST_EXERCISE = "test-exercise";
const TEST_DATE = "2024-01-01T00:00:00Z";

interface TestFilesData {
  solution: FileContent[];
  test: FileContent[];
  editor: FileContent[];
  example: FileContent[];
}

export interface TestExerciseData {
  track: TrackData;
  exercise: ExerciseData;
  solution: SolutionData | null;
  files: TestFilesData | null;
  iteration: IterationData | null;
}

export function createProfile(data?: Partial<ProfileData>): ProfileData {
  return {
    handle: TEST_HANDLE,
    total_reputation: 42,
    ...data,
  };
}

export function createTrack(data?: Partial<TrackData>): TrackData {
  const slug = data?.slug ?? TEST_TRACK;
  return {
    slug,
    course: true,
    icon_url: `https://assets.exercism.org/tracks/${slug}.svg`,
    tags: ["Windows", "macOS", "Linux"],
    last_touched_at: "2024-01-01T00:00:00Z",
    is_new: false,
    is_joined: false,
    has_notifications: false,
    ...data,
  };
}

export function createExercise(
  data: Partial<TestExerciseData> = {},
): TestExerciseData {
  const slug = data.exercise?.slug ?? TEST_EXERCISE;
  const status = data.solution?.status ?? "started";
  const started = data.solution || data.files || data.iteration;
  const iterated = status !== "started";
  const numIterations = data.iteration?.idx ?? data.solution?.num_iterations ??
    (iterated ? 1 : 0);

  const track = createTrack(data.track);

  const exercise = {
    slug,
    title: toPascalCase(slug),
    difficulty: "easy",
    blurb: `Exercise ${slug} on Exercism.`,
    is_unlocked: true,
    is_recommended: false,
    ...data.exercise,
  } satisfies ExerciseData;

  const solution = started
    ? {
      uuid: `${track.slug}-${exercise.slug}-solution-uuid`,
      status,
      mentoring_status: "none" as const,
      ...(status === "published"
        ? { published_iteration_head_tests_status: "passed" }
        : {}),
      has_notifications: false,
      num_views: 0,
      num_stars: 0,
      num_comments: 0,
      num_iterations: numIterations,
      num_loc: 10,
      is_out_of_date: false,
      ...(status === "published" ? { published_at: TEST_DATE } : {}),
      ...(status === "completed" ? { completed_at: TEST_DATE } : {}),
      ...(status === "started" ? { updated_at: TEST_DATE } : {}),
      ...(status === "iterated" ? { last_iterated_at: TEST_DATE } : {}),
      exercise: {
        slug: exercise.slug ?? "",
        title: toPascalCase(exercise?.slug ?? ""),
        icon_url: `https://assets.exercism.org/exercises/${exercise.slug}.svg`,
      },
      track: {
        slug: track.slug ?? "",
        title: toPascalCase(track?.slug ?? ""),
        icon_url: `https://assets.exercism.org/tracks/${track.slug}.svg`,
      },
      ...data.solution,
    } satisfies SolutionData
    : null;

  const files = started
    ? {
      solution: [{
        filename: `${exercise.slug}.${track.slug}`,
        type: "solution",
        content: "solution-file-contents",
      }],
      test: [{
        filename: `${exercise.slug}_test.${track.slug}`,
        content: "test-file-contents",
      }],
      editor: [{
        filename: `${exercise.slug}_data.${track.slug}`,
        type: "readonly",
        content: "editor-file-contents",
      }],
      example: [{
        filename: `.meta/example.${track.slug}`,
        content: "example-file-contents",
      }],
      ...data.files,
    } satisfies TestFilesData
    : null;

  const iteration = iterated
    ? {
      uuid: `${track.slug}-${exercise.slug}-solution-uuid`,
      idx: numIterations,
      status: "no_automated_feedback" as const,
      num_essential_automated_comments: 0,
      num_actionable_automated_comments: 0,
      num_non_actionable_automated_comments: 0,
      num_celebratory_automated_comments: 0,
      submission_method: "api",
      created_at: TEST_DATE,
      tests_status: "passed" as const,
      is_published: status === "published",
      is_latest: true,
      ...data.iteration,
    } satisfies IterationData
    : null;

  return { track, exercise, solution, files, iteration };
}

export function createSubmission(status: SubmissionTestStatus): SubmissionData {
  return {
    uuid: "submission-uuid",
    tests_status: status,
  };
}

export function createTestRun(
  status: TestRunStatus,
  message = "",
): TestRunData {
  return {
    status,
    message,
    tests: [{ name: "test-name", status: status, message: status }],
  };
}

export function createCompletion(
  exercise: TestExerciseData,
): CompletionData {
  return {
    track: {
      slug: exercise.track.slug ?? "test-track",
      num_completed_exercises: exercise.track.num_completed_exercises ?? 0 + 1,
    },
    exercise: {
      slug: exercise.exercise.slug ?? "test-exercise",
    },
  };
}
