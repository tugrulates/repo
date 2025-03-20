// deno-lint-ignore-file no-console
import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type { IterationData } from "./data.ts";
import { ApiElement } from "./data.ts";
import type { Exercise } from "./exercise.ts";
import type { Solution } from "./solution.ts";
import type { Track } from "./track.ts";

export class Iteration extends ApiElement<IterationData> {
  readonly app: App;
  readonly track: Track;
  readonly exercise: Exercise;

  constructor(readonly solution: Solution) {
    super();
    this.app = solution.app;
    this.track = solution.track;
    this.exercise = solution.exercise;
  }

  override async url(): Promise<string> {
    return (
      (await this.data()).links?.self ?? this.app.urls.iteration(this.exercise)
    );
  }

  async published(): Promise<boolean> {
    return (await this.data()).is_published ?? false;
  }

  async passing(): Promise<boolean> {
    const status = (await this.data()).tests_status;
    return status === "passed";
  }

  async failing(): Promise<boolean> {
    const status = (await this.data()).tests_status;
    return (
      status === "failed" ||
      status === "errored" ||
      status === "exceptioned" ||
      status === "cancelled"
    );
  }

  async hasAutomatedFeedback(): Promise<boolean> {
    return (
      (await this.data()).num_essential_automated_comments !== 0 ||
      (await this.data()).num_actionable_automated_comments !== 0 ||
      (await this.data()).num_non_actionable_automated_comments !== 0
    );
  }

  async hasHumanFeedback(): Promise<boolean> {
    return (await this.data()).num_celebratory_automated_comments !== 0;
  }

  async publish(): Promise<boolean> {
    console.debug(this.exercise.messages.publishIterations.progress);

    await this.sync();
    if (await this.published()) {
      console.debug(this.exercise.messages.publishIterations.skip);
      return true;
    }

    await this.app.api.publishIterations(this.solution);
    await this.sync();
    if (!(await this.published())) {
      console.error(this.exercise.messages.publishIterations.failure);
      return false;
    }

    console.log(this.exercise.messages.publishIterations.success);
    return true;
  }

  override async data(options: CacheGetOptions = {}): Promise<IterationData> {
    return await this.app.api.latestIteration(this.solution, options);
  }
}
