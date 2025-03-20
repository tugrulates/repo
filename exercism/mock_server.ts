import { assertExists } from "@std/assert";
import { type ApiMethod, methods } from "./api.ts";
import type {
  CompletionData,
  FileContent,
  ProfileData,
  SubmissionData,
  TestRunData,
  TrackData,
} from "./data.ts";
import {
  createCompletion,
  createExercise,
  createProfile,
  createTrack,
  type TestExerciseData,
} from "./test_data.ts";

export const NOT_FOUND = new Response(null, { status: 404 });
export const TOO_MANY_REQUESTS = new Response(null, { status: 429 });
export const TOKEN = "token";

interface HandlerOptions {
  times?: number;
}

interface Handler {
  response:
    | Response
    | object
    | string
    | ((request: Request) => object | string);
  options: HandlerOptions;
}

export class MockServer {
  private server: Deno.HttpServer<Deno.NetAddr> | undefined;
  private store = new Map<string, Map<string, TestExerciseData>>();
  private handlers = new Map<string, Handler[]>();

  submittedFiles: FileContent[] = [];

  constructor() {
    this.reset();
    this.server = Deno.serve({
      port: 0,
      handler: async (request: Request) => {
        const url = new URL(request.url);
        const path = url.pathname + url.search;
        const method = request.method;
        const handlers = this.handlers.get(key({ path, method }));
        if (handlers?.length) {
          const handler = handlers[0];
          assertExists(handler);
          if (handler.options.times) {
            handler.options.times--;
            if (handler.options.times === 0) {
              handlers.shift();
            }
          }
          const response = (typeof handler.response === "function")
            ? await handler.response(request)
            : handler.response;
          if (response instanceof Response) return response;
          if (typeof response === "string") return new Response(response);
          return new Response(JSON.stringify(response, null, 2));
        }
        throw new Error(
          `No handler found for ${request.method} ${url.pathname}${url.search}`,
        );
      },
    });
  }

  reset(): this {
    this.store.clear();
    this.handlers.clear();
    this.submittedFiles = [];
    this.respond(methods.validateToken, this.validateToken.bind(this));
    this.respond(methods.tracks, []);
    return this;
  }

  private validateToken(request: Request): Response {
    const token = request.headers.get("Authorization")?.split("Bearer ")[1];
    return new Response(
      JSON.stringify({
        error: {
          type: "invalid_auth_token",
          message: "The auth token provided is invalid",
        },
      }),
      { status: token === TOKEN ? 200 : 401 },
    );
  }

  profile(profile: ProfileData): this {
    this.respond(methods.user, { user: { handle: profile.handle } });
    this.respond(methods.reputation, {
      meta: { total_reputation: profile.total_reputation },
    });
    return this;
  }

  tracks(...tracks: TrackData[]): this {
    this.respond(methods.tracks, { tracks });
    for (const track of tracks) {
      this.respond(methods.exercises(track), {});
    }
    return this;
  }

  private addExercise(exercise: TestExerciseData): this {
    const track = exercise.track.slug ?? "";
    const exercises = this.store.get(track) ?? new Map();
    exercises.set(exercise.exercise.slug, exercise);
    this.store.set(track, exercises);
    return this;
  }

  exercises(...exercises: TestExerciseData[]): this {
    exercises.forEach((exercise) => this.addExercise(exercise));

    for (const [track, exercises] of this.store.entries()) {
      this.respond(methods.exercises({ slug: track }), {
        exercises: [...exercises.values()].map((e) => e.exercise),
        solutions: [...exercises.values()].map((e) => e.solution).filter((s) =>
          s !== null
        ),
      });
      for (const exercise of exercises.values()) {
        const { solution, files, iteration } = exercise;
        if (!solution) continue;
        this.respond(methods.solution(solution), { solution });
        this.respond(methods.files(solution), {
          files: {
            solution: files?.solution.map((file) => file.filename),
            test: files?.test.map((file) => file.filename),
            editor: files?.editor.map((file) => file.filename),
            example: files?.example.map((file) => file.filename),
          },
        });
        [
          ...files?.solution ?? [],
          ...files?.test ?? [],
          ...files?.editor ?? [],
          ...files?.example ?? [],
        ]
          .forEach((file) => {
            this.respond(
              methods.submissionFile(solution, file.filename ?? ""),
              file.content ?? "",
            );
          });
        this.respond(methods.latestIteration(solution), { iteration });
        if (iteration) {
          this.respond(
            methods.iterationFiles(solution),
            { files: [...files?.solution ?? [], ...files?.editor ?? []] },
          );
        }
      }
    }
    return this;
  }

  submissionFile(
    current: TestExerciseData,
    filename: string,
    response: Response | string,
  ): this {
    assertExists(current.solution);
    this.respond(methods.submissionFile(current.solution, filename), response);
    return this;
  }

  iterationFiles(
    current: TestExerciseData,
    response: Response | FileContent[],
  ): this {
    assertExists(current.solution);
    this.respond(
      methods.iterationFiles(current.solution),
      response instanceof Response ? response : { files: response },
    );
    return this;
  }

  onStart(
    current: TestExerciseData,
    updated: TestExerciseData,
  ): this {
    this.respond(
      methods.start(current.track, current.exercise),
      () => {
        this.exercises(updated);
        return updated?.solution ?? {};
      },
      { times: 1 },
    );
    return this;
  }

  onSubmit(
    current: TestExerciseData,
    updated: TestExerciseData,
    submission: SubmissionData,
  ): this {
    assertExists(current.solution);
    this.respond(methods.submit(current.solution), async (request: Request) => {
      assertExists(updated.solution);
      assertExists(request.body);
      this.exercises(updated);
      const { files } = await request.json() as { files: FileContent[] };
      this.submittedFiles = files;
      return { submission };
    }, { times: 1 });
    return this;
  }

  onTestRun(
    current: TestExerciseData,
    submission: SubmissionData,
    testRun: TestRunData,
  ): this {
    assertExists(current.solution);
    this.respond(methods.testRun(current.solution, submission), {
      test_run: testRun,
    }, {
      times: 1,
    });
    return this;
  }

  onCreateIteration(
    current: TestExerciseData,
    updated: TestExerciseData,
  ): this {
    assertExists(current.solution);
    this.respond(methods.createIteration(current.solution), () => {
      this.exercises(updated);
      return { iteration: updated.iteration };
    }, { times: 1 });
    return this;
  }

  onComplete(
    current: TestExerciseData,
    updated: TestExerciseData,
    options: { completion?: CompletionData; unlocked?: TestExerciseData[] } =
      {},
  ): this {
    const unlocked = options.unlocked?.map((e) => ({
      slug: e.exercise.slug ?? "",
      is_unlocked: true,
    }));
    const completion = {
      ...(options.completion ?? createCompletion(current)),
      ...(unlocked ? { unlocked_exercises: unlocked } : {}),
    };
    assertExists(current.solution);
    this.respond(methods.complete(current.solution), () => {
      this.exercises(updated, ...(options.unlocked ?? []));
      return { completion };
    }, { times: 1 });
    return this;
  }

  onPublish(
    current: TestExerciseData,
    updated: TestExerciseData,
  ): this {
    assertExists(current.solution);
    this.respond(methods.publish(current.solution), () => {
      this.exercises(updated);
      return { solution: current.solution };
    }, { times: 1 });
    return this;
  }

  onPublishIteration(
    current: TestExerciseData,
    updated: TestExerciseData,
  ): this {
    assertExists(current.solution);
    this.respond(methods.publishIterations(current.solution), () => {
      this.exercises(updated);
      return { solution: current.solution };
    }, { times: 1 });
    return this;
  }

  onUpdate(
    current: TestExerciseData,
    updated: TestExerciseData,
  ): this {
    assertExists(current.solution);
    this.respond(methods.update(current.solution), () => {
      this.exercises(updated);
      return { solution: current.solution };
    }, { times: 1 });
    return this;
  }

  get endpoint(): string {
    return `http://${this.server?.addr.hostname}:${this.server?.addr.port}`;
  }

  respond(
    apiMethod: ApiMethod,
    response:
      | object
      | string
      | ((request: Request) => object | string | Promise<object | string>),
    options: HandlerOptions = {},
  ): void {
    if (options.times) {
      const current = this.handlers.get(key(apiMethod)) ?? [];
      this.handlers.set(key(apiMethod), [...current, { response, options }]);
    } else {
      this.handlers.set(key(apiMethod), [{ response, options }]);
    }
  }

  async shutdown(): Promise<void> {
    this.server?.shutdown();
    await this.server?.finished;
  }
}

function key({ path, method }: { path: string; method: string }): string {
  return `${method} ${path}`;
}

if (import.meta.main) {
  const profile = createProfile();
  const track = createTrack();
  const exercise = createExercise({ solution: {} });
  const server = new MockServer();
  server.profile(profile).tracks(track).exercises(exercise);
}
