import { pool } from "@roka/async/pool";
import type { JsonRequestOptions } from "@roka/http/json/client";
import type { RetryOptions } from "@roka/http/request";
import { retry } from "@std/async/retry";
import { STATUS_CODE } from "@std/http/status";
import { dirname, globToRegExp, join } from "@std/path";
import { type Client, client, type SolutionData } from "./client.ts";
import { CommandFailed } from "./error.ts";
import { generated } from "./strings.ts";

const FILE_CONCURRENCY = { concurrency: 2 };
const EXERCISE_CONCURRENCY = { concurrency: 4 };

/** A unit of data on Exercism which can be synced locally. */
export interface Element {
  /** The URL of the element on Exercism. */
  url: string;
  /** Refresh the element's data from Exercism. */
  sync(): Promise<void>;
}

/** The root client for Exercism and the local workspace. */
export interface Exercism extends Element {
  /** The local workspace path. */
  workspace: string;
  /** Returns whether the client is authenticated to a user. */
  authenticated(): Promise<boolean>;
  /** Returns the user's profile. */
  profile(): Promise<Profile>;
  /** Returns all or selected tracks from Exercism. */
  tracks(options?: TrackFilters): Promise<Track[]>;
  /** Returns a specific track by its slug. */
  track(slug: string): Promise<Track>;
}

/** The user's profile and reputation. */
export interface Profile extends Element {
  /** The user's handle. */
  handle: string;
  /** The user's total reputation. */
  reputation: number;
}

/** A language track on Exercism and the user's progress on it. */
export interface Track extends Element {
  /** The track's slug identifier. */
  slug: string;
  /** The track's display title. */
  title: string;
  /** Whether the user has joined this track. */
  joined: boolean;
  /** Whether the user has completed all exercises in this track. */
  completed: boolean;
  /** Number of exercises in the track. */
  numExercises: number;
  /** Number of completed exercises in the track. */
  numCompleted: number;
  /** Whether the track has any notifications. */
  hasNotifications: boolean;
  /** The track-specific tooling for setup, format, lint, and test. */
  toolchain?: Toolchain;
  /** Returns all or selected exercises in the track. */
  exercises(options?: ExerciseFilters): Promise<Exercise[]>;
  /** Returns a specific exercise by its slug. */
  exercise(slug: string): Promise<Exercise>;
}

/** An exercise within a track. */
export interface Exercise extends Element {
  /** The exercise's slug identifier. */
  slug: string;
  /** The track the exercise belongs to. */
  track: Track;
  /** The exercise's difficulty level. */
  difficulty: "easy" | "medium" | "hard" | undefined;
  /** The exercise's display title. */
  title: string;
  /** The exercise's description blurb. */
  blurb: string;
  /** Whether the exercise is unlocked for the user. */
  unlocked: boolean;
  /** The user's solution for the exercise, if started. */
  solution: Solution | null;
  /** Starts working on the exercise and returns the solution. */
  start(): Promise<Solution>;
}

/** The user's solution and related workflow. */
export interface Solution extends Element {
  /** The unique identifier for the solution. */
  uuid: string;
  /** The solution's files on the local workspace. */
  files: Files;
  /** Whether the solution has at least one iteration. */
  iterated: boolean;
  /** Whether the solution has been marked as completed. */
  completed: boolean;
  /** Whether the solution has been published. */
  published: boolean;
  /** Whether the solution is outdated compared to the latest iteration. */
  outdated: boolean;
  /** Whether the latest iteration is passing all tests. */
  passing: boolean;
  /** Whether the latest iteration is failing any tests. */
  failing: boolean;
  /** Whether the latest iteration has any automated feedback. */
  hasAutomatedFeedback: boolean;
  /** Whether the latest iteration has any human feedback. */
  hasHumanFeedback: boolean;
  /** Number of stars given to the solution by the community. */
  stars: number;
  /** Number of comments given to the solution by the community. */
  comments: number;
  /** Returns whether the solution is available locally. */
  downloaded(): Promise<boolean>;
  /** Downloads the solution's files to the local workspace. */
  download(options?: DownloadOptions): Promise<boolean>;
  /** Sets up the solution locally using the track's toolchain. */
  setup(): Promise<boolean>;
  /** Opens the solution's files in VSCode. */
  code(): Promise<boolean>;
  /** Opens a diff of the local solution against its submission in VSCode. */
  diff(options?: CodeOptions): Promise<boolean>;
  /** Formats the solution's files using the track's toolchain. */
  format(options?: CodeOptions): Promise<boolean>;
  /** Lints the solution's files using the track's toolchain. */
  lint(options?: CodeOptions): Promise<boolean>;
  /** Tests the solution's files using the track's toolchain. */
  test(options?: CodeOptions): Promise<boolean>;
  /** Submits the solution to Exercism. */
  submit(options?: SubmitOptions): Promise<boolean>;
  /** Marks the solution as completed. */
  complete(): Promise<boolean>;
  /** Publishes the solution to the community. */
  publish(): Promise<boolean>;
  /** Updates the solution to the latest iteration from Exercism. */
  update(): Promise<boolean>;
}

/** The solution's files and path helpers. */
export interface Files {
  /** Names of solution files to submit. */
  solution: string[];
  /** Names of test files to run locally. */
  test: string[];
  /** Names of example files for reference. */
  example: string[];
  /** Names of data files for the solution. */
  editor: string[];
  /** Names of invalidator files for the solution. */
  invalidator: string[];
  /** Returns the full path to a given file. */
  path(...paths: string[]): string;
  /** Returns whether a given file exists locally. */
  exists(...paths: string[]): Promise<boolean>;
}

/** Track-specific tooling for setup, format, lint, and test. */
export interface Toolchain {
  /** Initializes the exercise locally. */
  setup(exercise: Exercise): Promise<boolean>;
  /** Formats the solution's files. */
  format(files: Files): Promise<void>;
  /** Lints the solution's files. */
  lint(files: Files): Promise<void>;
  /** Tests the solution's files. */
  test(files: Files): Promise<void>;
}

/** Options for the {@link exercism} function. */
export interface ExercismOptions {
  /** The local workspace path. Defaults to the current working directory. */
  workspace?: string;
  /** The Exercism API endpoint. Defaults to "https://exercism.org". */
  endpoint?: string;
  /** The HTTP client to use for requests. Override for testing. */
  client?: Client;
  /** Options for the HTTP client. */
  request?: JsonRequestOptions;
}

/** Filters for selecting tracks. */
export interface TrackFilters {
  /** Track slugs to include. Supports glob patterns. */
  track?: string[];
  /** Whether to include only joined or unjoined tracks. */
  joined?: boolean | undefined;
}

/** Filters for selecting exercises. */
export interface ExerciseFilters {
  /** Exercise slugs to include. Supports glob patterns. */
  exercise?: string[];
  /** Select only easy exercises. */
  easy?: boolean | undefined;
  /** Select only medium exercises. */
  medium?: boolean | undefined;
  /** Select only hard exercises. */
  hard?: boolean | undefined;
  /** Select only unlocked exercises. */
  unlocked?: boolean | undefined;
  /** Select only started exercises. */
  started?: boolean | undefined;
  /** Select only iterated exercises. */
  iterated?: boolean | undefined;
  /** Select only completed exercises. */
  completed?: boolean | undefined;
  /** Select only published exercises. */
  published?: boolean | undefined;
  /** Select only outdated exercises. */
  outdated?: boolean | undefined;
  /** Select only passing exercises. */
  passing?: boolean | undefined;
  /** Select only failing exercises. */
  failing?: boolean | undefined;
  /** Select only exercises with automated feedback. */
  feedback?: boolean | undefined;
  /** Select only exercises with stars. */
  starred?: boolean | undefined;
  /** Select only exercises with comments. */
  commented?: boolean | undefined;
}

/** Options for the methods that could potentially open VSCode. */
export interface CodeOptions {
  /** Whether to open the result in VSCode. */
  code?: boolean;
}

/** Options for the {@link Solution.download} method. */
export interface DownloadOptions {
  /** Whether to overwrite existing files. */
  force?: boolean;
}

/** Options for the {@link Solution.submit} method. */
export interface SubmitOptions {
  /**
   * Whether to force submission even if pre-submit checks (format, lint and
   * test) are failing.
   */
  force?: boolean;
}

interface Context {
  workspace: string;
  endpoint: string;
  retry: RetryOptions;
  client: Client;
}

/** Creates an Exercism client to work on solutions. */
export function exercism(options?: ExercismOptions): Exercism {
  const {
    workspace = Deno.cwd(),
    endpoint = "https://exercism.org",
    request = {},
  } = options ?? {};
  const context: Context = {
    workspace,
    endpoint,
    retry: options?.request?.retry ?? {},
    client: options?.client ?? client(endpoint, request),
  };
  return {
    workspace: context.workspace,
    url: endpoint,
    async authenticated() {
      return await context.client.token.validate({
        allowedErrors: [STATUS_CODE.Unauthorized],
      });
    },
    async profile() {
      return await profile(context);
    },
    async tracks(options) {
      return await tracks(context, options);
    },
    async track(slug) {
      const [track] = await tracks(context, { track: [slug] });
      if (!track) throw new Deno.errors.NotFound(`Track not found: ${slug}`);
      return track;
    },
    async sync() {
      const profile = await this.profile();
      const tracks = await this.tracks();
      await Promise.all([
        profile.sync(),
        ...tracks.map((track) => track.sync()),
      ]);
    },
  };
}

async function profile(
  context: Context,
  options?: JsonRequestOptions,
): Promise<Profile> {
  const [user, reputation] = await Promise.all([
    context.client.user.get(options),
    context.client.user.reputation(options),
  ]);
  return {
    url: `${context.endpoint}/profiles/${user.user?.handle}`,
    handle: user?.user?.handle ?? "",
    reputation: reputation?.meta?.total_reputation ?? 0,
    async sync() {
      Object.assign(profile, await profile(context, { cache: "no-cache" }));
    },
  };
}

async function tracks(
  context: Context,
  filters: TrackFilters | undefined,
  options?: JsonRequestOptions,
): Promise<Track[]> {
  const data = await context.client.tracks.list(options);
  return (data.tracks ?? [])
    .map((item) => {
      const toolchain = item.slug && TOOLCHAINS[item.slug];
      const track = {
        slug: item.slug ?? "",
        url: item.links.self ?? item.web_url ?? "",
        title: item.title ?? "",
        joined: item.is_joined ?? false,
        completed: !!item.is_joined &&
          item.num_exercises === item.num_completed_exercises,
        numExercises: item.num_exercises ?? 0,
        numCompleted: item.num_completed_exercises ?? 0,
        hasNotifications: item.has_notifications ?? false,
        ...toolchain && { toolchain },
        async exercises(filters?: ExerciseFilters) {
          return await exercises(context, track, filters);
        },
        async exercise(slug: string) {
          const [exercise] = await exercises(context, track, {
            exercise: [slug],
          });
          if (!exercise) {
            throw new Deno.errors.NotFound(`Exercise not found: ${slug}`);
          }
          return exercise;
        },
        async sync() {
          const all = await tracks(context, filters, { cache: "no-cache" });
          const found = all.find((x) => x.slug === item.slug);
          if (found) Object.assign(track, found);
        },
      };
      return track;
    })
    .filter((track) =>
      !filters?.track?.length ||
      filters?.track?.some((slug) => globToRegExp(slug).test(track.slug))
    )
    .filter((track) =>
      filters?.joined === undefined ||
      filters?.joined === track.joined
    )
    .sort((a, b) =>
      b.numCompleted / b.numExercises - a.numCompleted / a.numExercises
    );
}

async function exercises(
  context: Context,
  track: Track,
  filters: ExerciseFilters | undefined,
  options?: JsonRequestOptions,
): Promise<Exercise[]> {
  const api = context.client.track(track.slug).exercises;
  const data = await api.list(options);
  const result: Exercise[] = (data.exercises ?? [])
    .map((item): Exercise => {
      return {
        slug: item.slug ?? "",
        track,
        url: `${context.endpoint}${item.links?.self}`,
        difficulty: item.difficulty,
        title: item.title ?? "",
        blurb: item.blurb ?? "",
        unlocked: item.is_unlocked ?? false,
        solution: null,
        async start() {
          await track.sync();
          await this.sync();
          if (!this.solution) {
            if (!track.joined) {
              throw new Error(`Track not joined: ${track.slug}`);
            }
            await context.client.track(track.slug).exercise(this.slug).start();
            await this.sync();
          }
          if (!this.solution) {
            throw new Error(`Failed to start: ${this.slug}`);
          }
          await this.solution.setup();
          return this.solution;
        },
        async sync() {
          const all = await exercises(context, track, {}, {
            cache: "no-cache",
          });
          const found = all.find((x) => x.slug === item.slug);
          if (found) Object.assign(this, found);
        },
      };
    })
    .filter((exercise) =>
      !filters?.exercise?.length ||
      filters?.exercise?.some((slug) => globToRegExp(slug).test(exercise.slug))
    )
    .filter((exercise) =>
      filters?.easy === undefined ||
      filters.easy === (exercise.difficulty === "easy")
    )
    .filter((exercise) =>
      filters?.medium === undefined ||
      filters.medium === (exercise.difficulty === "medium")
    )
    .filter((exercise) =>
      filters?.hard === undefined ||
      filters.hard === (exercise.difficulty === "hard")
    )
    .filter((exercise) =>
      filters?.unlocked === undefined ||
      filters.unlocked === exercise.unlocked
    );
  await pool(result, async (exercise) => {
    const found = (data.solutions ?? []).find((x) =>
      x.exercise?.slug === exercise.slug
    );
    if (!found) return;
    exercise.solution = await solution(context, exercise, found);
  }, EXERCISE_CONCURRENCY);
  return result
    .filter((exercise) =>
      filters?.started === undefined ||
      filters.started === !!exercise.solution
    )
    .filter((exercise) =>
      filters?.iterated === undefined ||
      filters.iterated === (exercise.solution?.iterated ?? false)
    )
    .filter((exercise) =>
      filters?.completed === undefined ||
      filters.completed === (exercise.solution?.completed ?? false)
    )
    .filter((exercise) =>
      filters?.published === undefined ||
      filters.published === (exercise.solution?.published ?? false)
    )
    .filter((exercise) =>
      filters?.outdated === undefined ||
      filters.outdated === (exercise.solution?.outdated ?? false)
    )
    .filter((exercise) =>
      filters?.passing === undefined ||
      filters.passing === exercise.solution?.passing
    )
    .filter((exercise) =>
      filters?.failing === undefined ||
      filters.failing === exercise.solution?.failing
    )
    .filter((exercise) =>
      filters?.feedback === undefined ||
      filters.feedback === exercise.solution?.hasAutomatedFeedback
    )
    .filter((exercise) =>
      filters?.starred === undefined ||
      (exercise.solution && filters.starred === exercise.solution.stars > 0)
    )
    .filter((exercise) =>
      filters?.commented === undefined ||
      (exercise.solution &&
        filters.commented === exercise.solution.comments > 0)
    );
}

async function solution(
  context: Context,
  exercise: Exercise,
  data: SolutionData,
  options?: JsonRequestOptions,
): Promise<Solution> {
  if (!data.uuid) {
    throw new Error(`Invalid solution UUID for: ${exercise.slug}`);
  }
  const api = context.client.solution(data.uuid);
  const completed = (data.status === "completed") ||
    (data.status === "published");
  const iterated = (data.status === "iterated") || completed;
  const [iterationData, solutionFiles] = await Promise.all([
    iterated ? api.iterations.latest(options) : undefined,
    files(context, exercise, data.uuid),
  ]);
  const iteration = iterationData?.iteration;
  const result: Solution = {
    uuid: data.uuid ?? "",
    url: data.public_url ?? "",
    files: solutionFiles,
    iterated,
    completed,
    published: data.status === "published" &&
      (iteration?.is_published ?? false),
    outdated: data.is_out_of_date ?? false,
    passing: iteration?.tests_status === "passed",
    failing: iteration?.tests_status
      ? [
        "failed",
        "errored",
        "exceptioned",
        "cancelled",
      ].includes(iteration?.tests_status)
      : false,
    hasAutomatedFeedback: [
      iteration?.num_essential_automated_comments,
      iteration?.num_actionable_automated_comments,
      iteration?.num_non_actionable_automated_comments,
    ].some((x) => x !== 0),
    hasHumanFeedback: iteration?.num_celebratory_automated_comments !== 0,
    stars: data.num_stars ?? 0,
    comments: data.num_comments ?? 0,
    async downloaded() {
      const exists = await pool(
        this.files.solution,
        (filename) => this.files.exists(filename),
        FILE_CONCURRENCY,
      );
      return exists.some((x) => x);
    },
    async download(options?: DownloadOptions) {
      await this.sync();
      // let changed = false;
      // let kept = false;
      const files = (await Promise.all([
        this.iterated ? api.files.iteration() : api.files.submission([
          ...this.files.solution,
          ...this.files.editor,
        ]),
        api.files.submission(this.files.test),
      ])).map((files) => files?.files ?? []).flat();
      await pool(files, async (file) => {
        if (file.filename === undefined || file.content === undefined) {
          throw new Error(`Invalid file content: ${file}`);
        }

        // const fileMessages = messages.file(file.filename);
        const path = this.files.path(file.filename);
        if (!options?.force && (await this.files.exists(path))) {
          if ((await Deno.readTextFile(path)) === file.content) {
            // console.debug(fileMessages.notChanged);
            return;
          }
          // if (!confirm(fileMessages.prompt.overwrite)) {
          if (!confirm(`Overwrite file? ${path}`)) {
            // console.log(fileMessages.skip);
            // kept = true;
            return;
          }
        }

        // changed = true;
        await Deno.mkdir(dirname(path), { recursive: true });
        await Deno.writeTextFile(path, file.content);
      }, FILE_CONCURRENCY);
      return true;
    },
    async setup() {
      if (!await this.downloaded()) {
        await this.download();
      }
      await exercise.track.toolchain?.setup(exercise);
      return true;
    },
    async code() {
      await this.setup();
      const command = new Deno.Command("code", {
        args: this.files.solution.map((x) => this.files.path(x)),
      });
      await command.output();
      return true;
    },
    async diff(options) {
      // console.debug(this.exercise.messages.diff.progress);

      const compareFile = async (
        file: string,
        before: string | null,
        after: string | null,
        options: CodeOptions | undefined,
      ) => {
        if (before === after) {
          // console.debug(messages.file(file).notChanged);
          return true;
        }
        // console.debug(messages.file(file).changed);

        if (options?.code) {
          let tempDir: string | undefined;
          try {
            let beforeFile = "/dev/null";
            if (before !== null) {
              tempDir = await Deno.makeTempDir();
              beforeFile = join(tempDir, file);
              await Deno.writeTextFile(beforeFile, before);
            }
            const local = this.files.path(file);
            const afterFile = await this.files.exists(local)
              ? local
              : "/dev/null";
            const command = new Deno.Command("code", {
              args: ["--wait", "--diff", beforeFile, afterFile],
            });
            await command.output();
            return await compareFile(file, before, after, { code: false });
          } finally {
            if (tempDir !== undefined) {
              await Deno.remove(tempDir, { recursive: true });
            }
          }
        }
      };

      await this.setup();
      await this.sync();
      const beforeContents = new Map<string, string>();
      const afterContents = new Map<string, string>();

      // Downloaded contents.
      if (this.iterated) {
        const files = (await api.files.iteration()).files;
        // if (!files.length) return false;
        for (const file of files ?? []) {
          if (file.filename === undefined || file.content === undefined) {
            // console.error(this.exercise.messages.download.failure);
            return false;
          }
          if (file.type === "solution") {
            beforeContents.set(file.filename, file.content);
          }
        }
      }

      // Local contents.
      await pool(this.files.solution, async (filename) => {
        if (await this.files.exists(filename)) {
          afterContents.set(
            filename,
            await Deno.readTextFile(this.files.path(filename)),
          );
        }
      }, FILE_CONCURRENCY);

      // Compare.
      const allFiles = Array.from(
        new Set([...beforeContents.keys(), ...afterContents.keys()]),
      );
      const result = (
        await Promise.all(
          allFiles.map(
            async (file) =>
              await compareFile(
                file,
                beforeContents.get(file) ?? null,
                afterContents.get(file) ?? null,
                options,
              ),
          ),
        )
      ).every((result) => result);

      // if (!quiet) {
      //   if (result) {
      //     console.log(this.exercise.messages.diff.notChanged);
      //   } else {
      //     console.warn(this.exercise.messages.diff.changed);
      //   }
      // }

      return result;
    },
    // deno-lint-ignore no-unused-vars
    async format(options) {
      await this.setup();
      await exercise.track.toolchain?.format(this.files);
      return true;
    },
    // deno-lint-ignore no-unused-vars
    async lint(options) {
      await this.setup();
      await exercise.track.toolchain?.lint(this.files);
      return true;
    },
    // deno-lint-ignore no-unused-vars
    async test(options) {
      await this.setup();
      await exercise.track.toolchain?.test(this.files);
      return true;
    },
    async submit(options) {
      await this.setup();

      if (
        !options?.force &&
        (!await this.format() || !await this.lint() || !await this.test())
      ) {
        return false;
      }

      if (await this.diff()) {
        // console.log(this.exercise.messages.submit.skip);
        return true;
      }

      if (options?.force) {
        // create a dummy submission so duplicate submission can run tests
        await api.submissions.create({ files: [] }, {
          allowedErrors: [STATUS_CODE.InternalServerError],
        });
      }

      // console.debug(this.exercise.messages.submit.uploading);
      // const files = await this.files.solutionFiles();
      const files = await pool(this.files.solution, async (filename) => ({
        filename,
        type: "solution" as const,
        content: await Deno.readTextFile(this.files.path(filename)),
      }), FILE_CONCURRENCY);
      const submission = (await api.submissions.create({ files }))
        .submission;

      if (!submission?.uuid) {
        // console.error(this.exercise.messages.submit.failure);
        throw new Error("Submission failed");
      }

      // console.debug(this.exercise.messages.test.waiting);

      const testRun = await retry(async () => {
        // const testRun = (await context.client.get<{ test_run: TestRunData }>(
        //   `/api/v2/solutions/${this.uuid}/submissions/${submission.uuid}/test_run`,
        // )).test_run;
        const testRun = (await api.submissions.testRun(submission.uuid))
          .test_run;
        if (testRun?.status === undefined || testRun.status === "queued") {
          throw new Error("Test run still queued");
        }
        return testRun;
      }, context.retry);

      if (testRun.status === "fail") {
        if (!testRun.tests) {
          // console.error(this.exercise.messages.test.failure);
        }
        for (const test of testRun.tests ?? []) {
          if (test.status !== "pass") {
            // console.error(
            //   this.exercise.messages.test.testFailed({
            //     name: test.name ?? "",
            //     message: test.message ?? "",
            //   }),
            // );
          }
        }
        return false;
      } else if (testRun.status === "timeout") {
        // console.error(this.exercise.messages.test.timeout);
        return false;
      } else if (testRun.status !== "pass") {
        // console.error(this.exercise.messages.test.failure);
        return false;
      }

      // if (submission.tests_status === "not_queued") {
      //   // console.warn(this.exercise.messages.test.notQueued);
      // } else if (!await this.waitTests(submission)) {
      //   return false;
      // }

      // console.log(this.exercise.messages.submit.success);
      const iteration =
        (await api.iterations.create(submission.uuid)).iteration;
      if (!iteration) {
        // console.error(this.exercise.messages.submit.failure);
        return false;
      }
      await this.sync();
      if (!this.iterated) throw new Error("Failed to create iteration");
      return true;
    },
    async complete() {
      // console.debug(this.exercise.messages.complete.progress);

      await this.sync();
      if (this.completed) {
        // console.log(this.exercise.messages.complete.skip);
        return true;
      }

      if (!(await this.submit({ force: true }))) {
        return false;
      }

      const completion = await api.complete();
      await this.sync();
      if (!(this.completed)) {
        // console.error(this.exercise.messages.complete.failure);
        return false;
      }
      // console.log(this.exercise.messages.complete.success);

      await exercise.track.sync();
      await pool(
        await exercise.track.exercises({
          exercise: (completion?.unlocked_exercises ?? [])
            .filter((e) => e.slug)
            .map((e) => e.slug ?? ""),
        }),
        (exercise) => exercise.sync(),
        EXERCISE_CONCURRENCY,
      );
      // console.log(messages.exercise(unlocked.slug).unlocked);
      return true;
    },
    async publish() {
      // console.debug(this.exercise.messages.publish.progress);

      await this.sync();
      {
        if (this.published) {
          // console.log(this.exercise.messages.publish.skip);
          return true;
        }
      }

      if (!(await this.complete())) {
        return false;
      }

      if (!this.published) {
        await api.publish();
      }
      await api.iterations.publish();
      await this.sync();
      if (!this.published) {
        // console.error(this.exercise.messages.publish.failure);
        return false;
      }

      // console.log(this.exercise.messages.publish.success);
      return true;
    },
    async update() {
      // console.debug(this.exercise.messages.update.progress);

      await this.sync();
      if (!this.outdated) {
        // console.warn(this.exercise.messages.update.skip);
        return true;
      }

      await api.sync();
      await this.sync();
      if (this.failing) {
        // console.warn(this.exercise.messages.update.successWithFailedTests);
        return true;
      }

      // console.log(this.exercise.messages.update.success);
      return true;
    },
    async sync() {
      const data = await api.get({ cache: "no-cache" });
      if (!data.solution) {
        throw new Deno.errors.NotFound(`Solution not found: ${this.uuid}`);
      }
      Object.assign(
        this,
        await solution(context, exercise, data.solution, { cache: "no-cache" }),
      );
    },
  };
  return result;
}

async function files(
  context: Context,
  exercise: Exercise,
  uuid: string,
  options?: JsonRequestOptions,
): Promise<Files> {
  const api = context.client.solution(uuid);
  const files = (await api.files.list(options)).files;
  const result = {
    path(...paths: string[]) {
      return join(
        context.workspace,
        exercise.track.slug,
        exercise.slug,
        ...paths,
      );
    },
    async exists(...paths: string[]) {
      try {
        await Deno.stat(this.path(...paths));
        return true;
      } catch (e: unknown) {
        if (e instanceof Deno.errors.NotFound) return false;
        throw e;
      }
    },
    solution: files?.solution ?? [],
    test: files?.test ?? [],
    example: files?.example ?? [],
    editor: files?.editor ?? [],
    invalidator: files?.invalidator ?? [],
  };
  return result;
}

const TOOLCHAINS: Record<string, Toolchain> = {
  python: {
    async setup(exercise: Exercise): Promise<boolean> {
      const doc = `"""${generated.toolchain.docComment(exercise)}"""`;
      await pool(exercise.solution?.files?.solution ?? [], async (filename) => {
        const lines = (await Deno.readTextFile(filename)).split("\n");
        if (lines[0] === doc) return;
        // console.debug(messages.file(files.path(filename)).docgen);
        if (/^""".*"""$/.exec(lines[0] ?? "")) {
          lines.shift();
        }
        lines.unshift(doc);
        await Deno.writeTextFile(filename, lines.join("\n"));
      }, FILE_CONCURRENCY);
      return true;
    },
    async format(files: Files): Promise<void> {
      await new Shell().run("ruff", "format", ...(files.solution));
    },
    async lint(files: Files): Promise<void> {
      await new Shell().run("ruff", "check", ...(files.solution));
      await new Shell().run("mypy", ...(files.solution));
      await new Shell().run("pylint", ...(files.solution));
    },
    async test(files: Files): Promise<void> {
      await new Shell().run("pytest", ...(files.test));
    },
  },
};

class Shell {
  constructor(
    readonly options: Deno.CommandOptions = {},
  ) {}

  async run(cmd: string, ...args: string[]): Promise<string> {
    const command = new Deno.Command(cmd, { args, ...this.options });
    const { code, stdout, stderr } = await command.output();
    const [output, error] = [
      new TextDecoder().decode(stdout).trimEnd(),
      new TextDecoder().decode(stderr).trimEnd(),
    ];
    // deno-lint-ignore no-console
    if (output.length > 0) console.debug(output);
    // deno-lint-ignore no-console
    if (error.length > 0) console.debug(error);
    if (code === 0) return output;
    throw new CommandFailed(`${args.join(" ")}\n${error}`);
  }
}
