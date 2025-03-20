import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type {
  CompletionData,
  ExerciseData,
  FileContent,
  FilesData,
  IterationData,
  ReputationData,
  SolutionData,
  SubmissionData,
  TestRunData,
  TrackData,
  UserData,
} from "./data.ts";
import type { Exercise } from "./exercise.ts";
import { request, type RequestMethod, type RequestOptions } from "./request.ts";
import type { Solution } from "./solution.ts";
import type { Track } from "./track.ts";

const CACHE_EXPIRATION_MS = 1000 * 60 * 24;

export interface ApiMethod {
  path: string;
  method: RequestMethod;
}

// https://github.com/exercism/website/blob/main/config/routes/api.rb
export const methods = {
  validateToken: {
    path: "/api/v2/validate_token",
    method: "GET" as const,
  },
  user: {
    path: "/api/user",
    method: "GET" as const,
  },
  reputation: {
    path: "/api/v2/reputation",
    method: "GET" as const,
  },
  tracks: {
    path: "/api/v2/tracks",
    method: "GET" as const,
  },
  exercises: (track: Track | TrackData) => ({
    path: `/api/v2/tracks/${track.slug}/exercises?sideload[]=solutions`,
    method: "GET" as const,
  }),
  solution: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}`,
    method: "GET" as const,
  }),
  testRun: (solution: Solution | SolutionData, submission: SubmissionData) => ({
    path:
      `/api/v2/solutions/${solution.uuid}/submissions/${submission.uuid}/test_run`,
    method: "GET" as const,
  }),
  latestIteration: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/iterations/latest`,
    method: "GET" as const,
  }),
  files: (solution: Solution | SolutionData) => ({
    path: `/api/v1/solutions/${solution.uuid}/files/.exercism/config.json`,
    method: "GET" as const,
  }),
  submissionFile: (solution: Solution | SolutionData, filename: string) => ({
    path: `/api/v1/solutions/${solution.uuid}/files/${filename}`,
    method: "GET" as const,
  }),
  iterationFiles: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/last_iteration_files`,
    method: "GET" as const,
  }),
  start: (track: Track | TrackData, exercise: Exercise | ExerciseData) => ({
    path: `/api/v2/tracks/${track.slug}/exercises/${exercise.slug}/start`,
    method: "PATCH" as const,
  }),
  submit: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/submissions`,
    method: "POST" as const,
  }),
  createIteration: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/iterations`,
    method: "POST" as const,
  }),
  publish: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/publish`,
    method: "PATCH" as const,
  }),
  publishIterations: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/published_iteration`,
    method: "PATCH" as const,
  }),
  complete: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/complete`,
    method: "PATCH" as const,
  }),
  update: (solution: Solution | SolutionData) => ({
    path: `/api/v2/solutions/${solution.uuid}/sync`,
    method: "PATCH" as const,
  }),
};

export class Api {
  constructor(readonly app: App) {}

  async validateToken(token: string): Promise<boolean> {
    const { response } = await request(
      this.app.urls.url(methods.validateToken.path),
      methods.validateToken.method,
      { token, allowedErrors: ["invalid_auth_token"] },
    );
    if (response.ok) response.body?.cancel();
    return response.ok;
  }

  async user(options: CacheGetOptions = {}): Promise<UserData> {
    const response = await this.cachedRequest<{ user?: UserData }>(
      methods.user,
      options,
    );
    return response?.user ?? {};
  }

  async reputation(options: CacheGetOptions = {}): Promise<ReputationData> {
    const response = await this.cachedRequest<{ meta?: ReputationData }>(
      methods.reputation,
      options,
    );
    return response?.meta ?? {};
  }

  async tracks(options: CacheGetOptions = {}): Promise<TrackData[]> {
    const response = await this.cachedRequest<{ tracks: TrackData[] }>(
      methods.tracks,
      options,
    );
    return response?.tracks ?? [];
  }

  async exercises(
    track: Track,
    options: CacheGetOptions = {},
  ): Promise<ExerciseData[]> {
    const response = await this.cachedRequest<
      { exercises: ExerciseData[]; solutions: SolutionData[] }
    >(
      methods.exercises(track),
      {
        ...options,
        transform: (data) => ({
          exercises: data.exercises?.map((exercise) => ({
            ...exercise,
            solution_uuid: data.solutions?.find((solution) =>
              solution.exercise?.slug === exercise.slug
            )?.uuid ?? undefined,
          })) ?? [],
        }),
      },
    );
    return response?.exercises ?? [];
  }

  async solution(
    solution: Solution,
    options: CacheGetOptions = {},
  ): Promise<SolutionData> {
    const response = await this.cachedRequest<{
      solution: Partial<SolutionData>;
    }>(methods.solution(solution), options);
    return response?.solution ?? {};
  }

  async testRun(
    solution: Solution,
    submission: SubmissionData,
  ): Promise<TestRunData> {
    const response = await this.request<{ test_run: Partial<TestRunData> }>(
      methods.testRun(solution, submission),
    );
    return response.test_run ?? {};
  }

  async latestIteration(
    solution: Solution,
    options: CacheGetOptions = {},
  ): Promise<IterationData> {
    const response = await this.cachedRequest<{
      iteration: Partial<IterationData>;
    }>(methods.latestIteration(solution), options);
    return response?.iteration ?? {};
  }

  async files(
    solution: Solution,
    options: CacheGetOptions = {},
  ): Promise<FilesData> {
    const response = await this.cachedRequest<{ files: Partial<FilesData> }>(
      methods.files(solution),
      options,
    );
    return {
      solution: response?.files?.solution ?? [],
      test: response?.files?.test ?? [],
      editor: response?.files?.editor ?? [],
      example: response?.files?.example ?? [],
    };
  }

  async submissionFile(
    solution: Solution,
    filename: string,
  ): Promise<FileContent> {
    const response = await this.request<string>(
      methods.submissionFile(solution, filename),
      { raw: true },
    );
    return {
      filename,
      content: response ?? "",
    };
  }

  async iterationFiles(solution: Solution): Promise<FileContent[]> {
    const response = await this.request<{ files: FileContent[] }>(
      methods.iterationFiles(solution),
    );
    return response.files ?? [];
  }

  async start(
    exercise: Exercise,
    options: CacheGetOptions = {},
  ): Promise<SolutionData> {
    const response = await this.cachedRequest<{ solution: SolutionData }>(
      methods.start(exercise.track, exercise),
      options,
    );
    return response?.solution ?? {};
  }

  async submit(
    solution: Solution,
    files: FileContent[],
    { ignoreDuplicateSubmission = false } = {},
  ): Promise<SubmissionData> {
    const response = await this.request<{ submission: SubmissionData }>(
      methods.submit(solution),
      {
        body: JSON.stringify({ files }),
        allowedErrors: ignoreDuplicateSubmission
          ? ["duplicate_submission"]
          : [],
      },
    );
    return response.submission ?? {};
  }

  async createIteration(solution: Solution): Promise<IterationData> {
    const response = await this.request<{ iteration: IterationData }>(
      methods.createIteration(solution),
    );
    return response.iteration ?? {};
  }

  async publish(solution: Solution): Promise<SolutionData> {
    const response = await this.request<{ solution: SolutionData }>(
      methods.publish(solution),
    );
    return response.solution ?? {};
  }

  async publishIterations(solution: Solution): Promise<SolutionData> {
    const response = await this.request<{ solution: SolutionData }>(
      methods.publishIterations(solution),
    );
    return response.solution ?? {};
  }

  async complete(solution: Solution): Promise<CompletionData> {
    const response = await this.request<{ completion: CompletionData }>(
      methods.complete(solution),
    );
    return response.completion ?? {};
  }

  async update(solution: Solution): Promise<SolutionData> {
    const response = await this.request<{ solution: SolutionData }>(
      methods.update(solution),
    );
    return response.solution ?? {};
  }

  private async cachedRequest<T>(
    apiMethod: ApiMethod,
    options: CacheGetOptions & {
      transform?: (data: Partial<T>) => Partial<T>;
    } = {},
  ): Promise<Partial<T> | null> {
    const transform = options.transform ?? ((data) => data);
    const cached = this.app.cache.new(
      ["api", apiMethod.method.toString(), apiMethod.path],
      async () => transform(await this.request<T>(apiMethod)),
      { expireIn: CACHE_EXPIRATION_MS },
    );
    return await cached.get(options);
  }

  private async request<T>(
    apiMethod: ApiMethod,
    options: RequestOptions & { raw?: boolean } = {},
  ): Promise<Partial<T>> {
    const { response } = await request(
      this.app.urls.url(apiMethod.path),
      apiMethod.method,
      {
        token: await this.app.token.get({ cacheOnly: false }),
        ...this.app.options,
        ...options,
      },
    );
    const result = options.raw ? response.text() : response.json();
    return (await result) as Partial<T>;
  }
}
