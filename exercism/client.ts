// deno-lint-ignore-file camelcase
import { pool } from "@roka/async/pool";
import {
  client as jsonClient,
  type JsonRequestOptions,
} from "@roka/http/json/client";
import { request, type RequestOptions } from "@roka/http/request";

/**
 * An API client for the Exercism platform.
 *
 * The routes are based on the [API code](https://github.com/exercism/website/blob/main/config/routes/api.rb).
 */
export interface Client {
  /** Authentication methods. */
  token: {
    /** Validate the current token. */
    validate(options?: JsonRequestOptions): Promise<boolean>;
  };
  /** Current user methods. */
  user: {
    /** Retrieve the user data for the authenticated user. */
    get(options?: JsonRequestOptions): Promise<Partial<{ user: UserData }>>;
    /** Retrieve the reputation data for the authenticated user. */
    reputation(
      options?: JsonRequestOptions,
    ): Promise<Partial<{ results: ReputationData[]; meta: ReputationMeta }>>;
  };
  /** Track methods. */
  tracks: {
    /** List all available tracks. */
    list(
      options?: JsonRequestOptions,
    ): Promise<Partial<{ tracks: TrackData[] }>>;
  };
  /** Methods for a specific track. */
  track(slug: string): {
    /** Methods for exercises in the track. */
    exercises: {
      /** List all exercises and user's submitted solutions in the track. */
      list(
        options?: JsonRequestOptions,
      ): Promise<
        Partial<{ exercises: ExerciseData[]; solutions: SolutionData[] }>
      >;
    };
    /** Methods for a specific exercise in the track. */
    exercise(slug: string): {
      /** Start the exercise for the user. */
      start(
        options?: JsonRequestOptions,
      ): Promise<Partial<{ solution: SolutionData }>>;
    };
  };
  /** Methods for a specific solution. */
  solution(uuid: string): {
    /** Retrieve the solution data. */
    get(
      options?: JsonRequestOptions,
    ): Promise<Partial<{ solution: SolutionData }>>;
    /** Mark the solution as complete. */
    complete(
      options?: JsonRequestOptions,
    ): Promise<Partial<CompletionData>>;
    /** Publish the solution. */
    publish(
      options?: JsonRequestOptions,
    ): Promise<Partial<{ solution: SolutionData }>>;
    /** Sync the solution with the latest exercise version. */
    sync(
      options?: JsonRequestOptions,
    ): Promise<Partial<{ solution: SolutionData }>>;
    /** Methods for submitting solutions. */
    submissions: {
      /** Create a new submission for the solution with the given files. */
      create(
        body: { files: FileContent[] },
        options?: JsonRequestOptions,
      ): Promise<Partial<{ submission: SubmissionData }>>;
      /** Retrieve the test run results for a specific submission. */
      testRun(
        submissionUuid: string,
        options?: JsonRequestOptions,
      ): Promise<Partial<{ test_run: TestRunData }>>;
    };
    /** Methods for iterations of the solution. */
    iterations: {
      /** Create a new iteration for a specific submission. */
      create(
        submissionUuid: string,
        options?: JsonRequestOptions,
      ): Promise<Partial<{ iteration: IterationData }>>;
      /** Retrieve the latest iteration for the solution. */
      latest(
        options?: JsonRequestOptions,
      ): Promise<Partial<{ iteration: IterationData }>>;
      /** Publish the latest iteration for the solution. */
      publish(
        options?: JsonRequestOptions,
      ): Promise<Partial<{ iteration: IterationData }>>;
    };
    /** Methods for files associated with the solution. */
    files: {
      /** List all files in the solution's configuration. */
      list(
        options?: JsonRequestOptions,
      ): Promise<Partial<{ files: FilesData }>>;
      /** Retrieve the content of specific files in the solution. */
      submission(
        filenames: string[],
        options?: JsonRequestOptions,
      ): Promise<Partial<{ files: FileContent[] }>>;
      /** Retrieve the files from the latest iteration. */
      iteration(
        options?: JsonRequestOptions,
      ): Promise<Partial<{ files: FileContent[] }>>;
    };
  };
}

/** User data returned by the API. */
export interface UserData {
  /** The user's unique identifier. */
  handle: string;
  /** Whether the user is an insider on Exercism. */
  insiders_status: InsidersStatus;
}

/** Reputation data returned by the API. */
export interface ReputationData {
  /** The unique identifier for the reputation entry. */
  uuid: string;
  /** The reputation points awarded or deducted. */
  value: number;
  /** A brief title describing the reputation event. */
  text: string;
  /** Icon for the reputation event. */
  icon_url: string;
  /** Internal URL associated with the reputation event. */
  internal_url: string;
  /** External URL associated with the reputation event, if any. */
  external_url: string | null;
  /** The timestamp when the reputation event was created. */
  created_at: string;
  /** Whether the reputation event has been seen by the user. */
  is_seen: boolean;
  /** Track for which the event occurred. */
  track: {
    /** Display title of the track. */
    title?: string;
    /** Icon URL of the track. */
    icon_url?: string;
  };
  /** Links related to the reputation event. */
  links: {
    /** Link to mark the event as seen. */
    mark_as_seen?: string;
  };
}

/** Metadata about the reputation entries returned by the API. */
export interface ReputationMeta {
  /** The current page number in the paginated results. */
  current_page: number;
  /** Number of reputation entries. */
  total_count: number;
  /** Total number of pages available. */
  total_pages: number;
  /** The user's total reputation points. */
  total_reputation: number;
  /** Number of unseen reputation entries. */
  unseen_total: number;
  /** Links related to the reputation entries. */
  links: {
    /** Next page token, if any. */
    tokens?: string;
    /** Link to mark all reputation entries as seen. */
    mark_all_as_seen?: string;
  };
}

/** Track data returned by the API. */
export interface TrackData {
  /** The unique identifier of the track. */
  slug: string;
  /** The display title of the track. */
  title: string;
  /** Whether the track has a learning course. */
  course: boolean;
  /** Number of concepts in this track's learning course. */
  num_concepts: number;
  /** Number of exercises in this track. */
  num_exercises: number;
  /** The URL of the track on the website. */
  web_url: string;
  /** The URL to the track's icon image. */
  icon_url: string;
  /** Tags associated with the track. */
  tags: string[];
  /** Timestamp when the track was last updated. */
  last_touched_at: string | null;
  /** Whether the track is new on Exercism. */
  is_new: boolean;
  /** Whether the user has joined the track. */
  is_joined?: boolean;
  /** Number of concepts the user has completed in this track. */
  num_learned_concepts?: number;
  /** Number of exercises the user has completed in this track. */
  num_completed_exercises?: number;
  /** Number of solutions the user has submitted in this track. */
  num_solutions?: number;
  /** Whether the user has any notifications for this track. */
  has_notifications?: boolean;
  /** Links related to the track. */
  links: {
    /** Link to the track itself. */
    self?: string;
    /** Link to the exercises in the track. */
    exercises?: string;
    /** Link to the concepts in the track. */
    concepts?: string;
  };
}

/** Exercise data returned by the API. */
export interface ExerciseData {
  /** The unique identifier of the exercise. */
  slug: string;
  /** The type of the exercise. */
  type: ExerciseType;
  /** The display title of the exercise. */
  title: string;
  /** The URL of the exercise icon. */
  icon_url: string;
  /** The difficulty of the exercise. */
  difficulty: ExerciseDifficulty;
  /** A short description of the exercise. */
  blurb: string;
  /** Whether the exercise is from another platform. */
  is_external: boolean;
  /** Whether the user has unlocked the exercise. */
  is_unlocked: boolean;
  /** Whether this is a recommended exercise for the user. */
  is_recommended: boolean;
  /** Links related to the exercise. */
  links: {
    /** Link to the exercise itself. */
    self?: string;
  };
}

/** Concept data returned by the API. */
export interface ConceptData {
  /** The unique identified of the concept. */
  slug: string;
  /** The display name of the concept. */
  name: string;
  /** Links related to the concept. */
  links: {
    /** Link to the concept itself. */
    self?: string;
  };
}

/** Task data returned by the API. */
export interface TaskData {
  /** The unique identifier of the task. */
  id: number;
  /** The display name of the task. */
  title: string;
}

/** Solution data returned by the API. */
export interface SolutionData {
  /** The unique identifier of the solution. */
  uuid: string;
  /** The URL to the solution for the user. */
  private_url: string;
  /** The URL to the solution for the community. */
  public_url: string;
  /** The completion status of the solution. */
  status: SolutionStatus;
  /** The mentoring status of the solution. */
  mentoring_status: MentoringStatus;
  /** The test status of the published iteration. */
  published_iteration_head_tests_status: SubmissionTestStatus;
  /** Whether the solution has notifications. */
  has_notifications: boolean;
  /** Number of times this solution has been viewed. */
  num_views: number;
  /** Number of stars this solution has received. */
  num_stars: number;
  /** Number of comments this solution has received. */
  num_comments: number;
  /** Number of iterations made for this solution. */
  num_iterations: number;
  /** Total number of lines of code in the solution. */
  num_loc: number | null;
  /** Whether the solution is for an outdated version of the exercise. */
  is_out_of_date: boolean;
  /** Timestamp when the solution was published. */
  published_at: string | null;
  /** Timestamp when the solution was marked completed. */
  completed_at: string | null;
  /** Timestamp when the solution was last updated. */
  updated_at: string | null;
  /** Timestamp when the last iteration of the solution was created. */
  last_iterated_at: string | null;
  /** Track of this solution. */
  track: {
    /** The unique identifier of the track. */
    slug?: string;
    /** The display title of the track. */
    title?: string;
    /** The URL to the track's icon image. */
    icon_url?: string;
  };
  /** Exercise of this solution. */
  exercise: {
    /** The unique identifier of the exercise. */
    slug?: string;
    /** The display title of the exercise. */
    title?: string;
    /** The URL to the exercise's icon image. */
    icon_url?: string;
  };
}

/** Submission data returned by the API. */
export interface SubmissionData {
  /** The unique identifier of the submission. */
  uuid: string;
  /** Test status of the submission. */
  tests_status: SubmissionTestStatus;
  /** Links related to the submission. */
  links: {
    /** The URL to cancel the submission. */
    cancel?: string;
    /** The URL to push this submission. */
    submit?: string;
    /** The URL to the test run results of this submission. */
    test_run?: string;
    /** The URL to automated help on this submission. */
    ai_help?: string;
    /** The URL to the files of this submission. */
    initial_files?: string;
    /** The URL to the files of the last iteration of this submission. */
    last_iteration_files?: string;
  };
}

/** Test run data returned by the API. */
export interface TestRunData {
  /** The unique identifier of the test run. */
  uuid: string;
  /** The submission identifier of the test run. */
  submission_uuid: string;
  /** The version of the test runner. */
  version: number;
  /** The overall status of the test run. */
  status: TestRunStatus;
  /** User message explaining the test run status. */
  message: string | null;
  /** User message in HTML format explaining the test run status. */
  message_html: string | null;
  /** Test output. */
  output: string | null;
  /** Test output in HTML format. */
  output_html: string | null;
  /** Exercise tasks effected this test run. */
  tasks: TaskData[];
  /** Programming language of the test run. */
  highlightjs_language: string;
  /** Test results of the test run. */
  tests: TestResultData[];
  /** Links related to the test run. */
  links: {
    /** Link to the test run itself. */
    self?: string;
  };
}

/** Test result data returned by the API. */
export interface TestResultData {
  /** The name of the test. */
  name: string;
  /** The overall status of the test. */
  status: TestRunStatus;
  /** The code of the test. */
  test_code: string | null;
  /** User message explaining the test result. */
  message: string | null;
  /** User message in HTML format explaining the test result. */
  message_html: string | null;
  /** Expected output of the test. */
  expected: string | null;
  /** Actual output of the test. */
  output: string | null;
  /** Actual output of the test in HTML format. */
  output_html: string | null;
  /** The task identifier associated with the test, if any. */
  task_id: number | null;
}

/** Completion data returned by the API. */
export interface CompletionData {
  /** The track of the completed exercise. */
  track: TrackData;
  /** The exercise that was completed. */
  exercise: ExerciseData;
  /** Exercises that were unlocked with the completion. */
  unlocked_exercises: ExerciseData[];
  /** Concepts that were unlocked with the completion. */
  unlocked_concepts: ConceptData[];
  /** Overall progression of the user in the learning course. */
  concept_progressions: ConceptProgressionData[];
}

/** Concept progression data returned by the API. */
export interface ConceptProgressionData {
  /** The unique identifier of the track. */
  slug: string;
  /** The display name of the track. */
  name: string;
  /** Number of concepts previously learned in the track. */
  from: number;
  /** Number of concepts learned in the track. */
  to: number;
  /** Total number of concepts in the track. */
  total: number;
  /** Links related to the concept progression. */
  links: {
    /** Link to the track itself. */
    self?: string;
  };
}

/** Iteration data returned by the API. */
export interface IterationData {
  /** The unique identifier of the iteration. */
  uuid: string;
  /** The submission identifier of the iteration. */
  submission_uuid: string;
  /** The index of the iteration. */
  idx: number;
  /** The status of the iteration. */
  status:
    | IterationStatus
    | null;
  /** Number of automated warnings on the iteration. */
  num_essential_automated_comments: number;
  /** Number of actionable automated warning on the iteration. */
  num_actionable_automated_comments: number;
  /** Number of non-actionable automated warnings on the iteration. */
  num_non_actionable_automated_comments: number;
  /** Number of celebratory automated comments on the iteration. */
  num_celebratory_automated_comments: number;
  /** The method used to create the submission. */
  submission_method: SubmissionMethod | null;
  /** Timestamp when the iteration was created. */
  created_at: string;
  /** The status of the tests in the iteration. */
  tests_status: SubmissionTestStatus;
  /** Whether this is the published iteration. */
  is_published: boolean;
  /** Whether this is the latest iteration. */
  is_latest: boolean;
  /** Links related to the iteration. */
  links: {
    /** Link to the iteration itself. */
    self?: string;
    /** Link to automated warnings on the iteration. */
    automated_feedback?: string;
    /** Link to delete the iteration. */
    delete?: string;
    /** Link to the solution of the iteration. */
    solution?: string;
    /** Link to the test run of the iteration. */
    test_run?: string;
    /** Link to the files of the iteration. */
    files?: string;
  };
}

/** Files data returned by the API. */
export interface FilesData {
  /** Filenames of the solution files. */
  solution: string[];
  /** Filenames of the test files. */
  test: string[];
  /** Filenames of the example files. */
  example: string[];
  /** Filenames of the editor files. */
  editor?: string[];
  /** Filenames of the invalidator files. */
  invalidator?: string[];
}

/** File content for submission or iteration. */
export interface FileContent {
  /** The name of the file. */
  filename: string;
  /** The content of the file. */
  content: string;
  /** The type of the file. */
  type?: FileType;
  /** The SHA-256 digest of the file content. */
  digest?: string;
}

/** The type of a file. */
export type FileType =
  | "solution"
  | "readonly";

/** Insider status of a user on Exercism. */
export type InsidersStatus =
  | "ineligible"
  | "eligible"
  | "active"
  | "active_lifetime";

/** The type of an exercise. */
export type ExerciseType =
  | "practice"
  | "concept"
  | "tutorial";

/** The difficulty of an exercise. */
export type ExerciseDifficulty =
  | "easy"
  | "medium"
  | "hard";

/** The completion status of a solution. */
export type SolutionStatus =
  | "started"
  | "iterated"
  | "completed"
  | "published";

/** The mentoring status of a solution. */
export type MentoringStatus =
  | "none"
  | "requested"
  | "in_progress"
  | "finished";

/** The submission method of a solution. */
export type SubmissionMethod =
  | "api"
  | "cli";

/** The test status of a submission. */
export type SubmissionTestStatus =
  | "not_queued"
  | "queued"
  | "passed"
  | "failed"
  | "errored"
  | "exceptioned"
  | "cancelled";

/** The test status of an iteration. */
export type IterationStatus =
  | "untested"
  | "testing"
  | "tests_failed"
  | "analyzing"
  | "essential_automated_feedback"
  | "actionable_automated_feedback"
  | "celebratory_automated_feedback"
  | "non_actionable_automated_feedback"
  | "no_automated_feedback"
  | "deleted";

/** The test status of a test run. */
export type TestRunStatus =
  | "pass"
  | "fail"
  | "error"
  | "ops_error"
  | "queued"
  | "timeout"
  | "cancelled";

/** Create an Exercism API client for the given endpoint. */
export function client(endpoint: string, options?: RequestOptions): Client {
  const api = jsonClient(endpoint, options);
  const clientOptions = options ?? {};
  const client: Client = {
    token: {
      async validate(options) {
        const response = await request(
          new URL("/api/v2/validate_token", endpoint),
          { ...clientOptions, ...options },
        );
        response.body?.cancel();
        return response.ok;
      },
    },
    user: {
      get: (options) => api.get("/api/user", options),
      reputation: (options) => api.get("/api/v2/reputation", options),
    },
    tracks: {
      list: (options) => api.get("/api/v2/tracks", options),
    },
    track: (track) => ({
      exercises: {
        list: (options) =>
          api.get(
            `/api/v2/tracks/${track}/exercises?sideload[]=solutions`,
            options,
          ),
      },
      exercise: (exercise) => ({
        start: (options) =>
          api.patch(
            `/api/v2/tracks/${track}/exercises/${exercise}/start`,
            options,
          ),
      }),
    }),
    solution: (solution) => ({
      get: (options) => api.get(`/api/v2/solutions/${solution}`, options),
      complete: (options) =>
        api.patch(`/api/v2/solutions/${solution}/complete`, options),
      publish: (options) =>
        api.patch(`/api/v2/solutions/${solution}/publish`, options),
      sync: (options) =>
        api.patch(`/api/v2/solutions/${solution}/sync`, options),
      submissions: {
        create: (body, options) =>
          api.post(`/api/v2/solutions/${solution}/submissions`, {
            ...options,
            body,
          }),
        testRun: (submission, options) =>
          api.get(
            `/api/v2/solutions/${solution}/submissions/${submission}/test_run`,
            options,
          ),
      },
      iterations: {
        create: (submission, options) =>
          api.post(
            `/api/v2/solutions/${solution}/iterations?submission_uuid=${submission}`,
            options,
          ),
        latest: (options) =>
          api.get(
            `/api/v2/solutions/${solution}/iterations/latest`,
            options,
          ),
        publish: (options) =>
          api.patch(
            `/api/v2/solutions/${solution}/published_iteration`,
            options,
          ),
      },
      files: {
        list: (options) =>
          api.get(
            `/api/v1/solutions/${solution}/files/.exercism/config.json`,
            options,
          ),
        submission: async (filenames, options) => ({
          files: await pool(filenames, async (filename) => ({
            filename,
            content: await api.text(
              `/api/v1/solutions/${solution}/files/${filename}`,
              options,
            ),
          }), { concurrency: 1 }),
        }),
        iteration: (options) =>
          api.get(
            `/api/v2/solutions/${solution}/last_iteration_files`,
            options,
          ),
      },
    }),
  };
  return client;
}
