// deno-lint-ignore-file no-console
import { retry } from "@std/async";
import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type { SolutionData, SubmissionData } from "./data.ts";
import { ApiElement } from "./data.ts";
import type { Exercise } from "./exercise.ts";
import { Files } from "./files.ts";
import { Iteration } from "./iteration.ts";
import { messages } from "./strings.ts";
import type { Track } from "./track.ts";

export class Solution extends ApiElement<SolutionData> {
  readonly app: App;
  readonly track: Track;
  files: Files;

  constructor(
    readonly exercise: Exercise,
    readonly uuid: string,
  ) {
    super();
    this.app = exercise.app;
    this.track = exercise.track;
    this.files = new Files(this);
  }

  override async url(): Promise<string> {
    return (
      (await this.data()).public_url ??
        this.app.urls.solution(this.exercise, await this.app.profile.handle())
    );
  }

  async iterated(): Promise<boolean> {
    return ((await this.data()).num_iterations ?? 0) > 0;
  }

  async completed(): Promise<boolean> {
    const status = (await this.data()).status;
    return status === "completed" || status === "published";
  }

  async published(): Promise<boolean> {
    const status = (await this.data()).status;
    return status === "published";
  }

  async isDraft(): Promise<boolean> {
    return (await this.iterated()) && !(await this.published());
  }

  async outdated(): Promise<boolean> {
    return (await this.data()).is_out_of_date ?? false;
  }

  async stars(): Promise<number> {
    return (await this.data()).num_stars ?? 0;
  }

  async comments(): Promise<number> {
    return (await this.data()).num_comments ?? 0;
  }

  async iteration(): Promise<Iteration | null> {
    return (await this.iterated()) ? new Iteration(this) : null;
  }

  async submit(options: { force?: boolean } = {}): Promise<boolean> {
    const { force = false } = options;
    console.debug(this.exercise.messages.submit.progress);

    await this.sync();
    await this.files.setup();

    if (!force && !await this.presubmit()) {
      return false;
    }

    if (await this.files.diff({ quiet: true })) {
      console.log(this.exercise.messages.submit.skip);
      return true;
    }

    // empty submit to force a new submission
    await this.app.api.submit(this, [], { ignoreDuplicateSubmission: true });

    console.debug(this.exercise.messages.submit.uploading);
    const files = await this.files.solutionFiles();
    const submission = await this.app.api.submit(
      this,
      await Promise.all(
        files.map(async (file) => ({
          filename: this.files.name(file),
          type: "solution",
          content: await Deno.readTextFile(file),
        })),
      ),
    );

    if (!submission.uuid) {
      console.error(this.exercise.messages.submit.failure);
      return false;
    }

    if (submission.tests_status === "not_queued") {
      console.warn(this.exercise.messages.test.notQueued);
    } else if (!await this.waitTests(submission)) {
      return false;
    }

    console.log(this.exercise.messages.submit.success);

    return await this.createIteration();
  }

  private async presubmit(): Promise<boolean> {
    const presubmit = await Promise.all([
      this.files.format({ quiet: true }),
      this.files.lint({ quiet: true }),
      this.files.test({ quiet: true }),
    ]);
    return presubmit.every((result) => result);
  }

  private async waitTests(submission: SubmissionData): Promise<boolean> {
    console.debug(this.exercise.messages.test.waiting);

    const testRun = await retry(async () => {
      const testRun = await this.app.api.testRun(this, submission);
      if (testRun.status === undefined || testRun.status === "queued") {
        throw new Error("Test run still queued");
      }
      return testRun;
    }, this.app.options.retry);

    if (testRun.status === "fail") {
      if (!testRun.tests) {
        console.error(this.exercise.messages.test.failure);
      }
      for (const test of testRun.tests ?? []) {
        if (test.status !== "pass") {
          console.error(
            this.exercise.messages.test.testFailed({
              name: test.name ?? "",
              message: test.message ?? "",
            }),
          );
        }
      }
      return false;
    } else if (testRun.status === "timeout") {
      console.error(this.exercise.messages.test.timeout);
      return false;
    } else if (testRun.status !== "pass") {
      console.error(this.exercise.messages.test.failure);
      return false;
    }
    return true;
  }

  private async createIteration(): Promise<boolean> {
    console.debug(this.exercise.messages.createIteration.progress);
    await this.app.api.createIteration(this);
    await this.sync();
    if (!(await this.iterated())) {
      console.error(this.exercise.messages.createIteration.failure);
      return false;
    }
    await (await this.iteration())?.sync();

    console.debug(this.exercise.messages.createIteration.success);
    return true;
  }

  async complete(): Promise<boolean> {
    console.debug(this.exercise.messages.complete.progress);

    await this.sync();
    if (await this.completed()) {
      console.log(this.exercise.messages.complete.skip);
      return true;
    }

    if (!(await this.submit({ force: true }))) {
      return false;
    }

    const completion = await this.app.api.complete(this);
    await this.sync();
    if (!(await this.completed())) {
      console.error(this.exercise.messages.complete.failure);
      return false;
    }
    console.log(this.exercise.messages.complete.success);

    await this.track.sync();
    for (const unlocked of completion.unlocked_exercises ?? []) {
      if (unlocked.slug !== undefined) {
        for await (
          const exercise of this.track.find({
            exercise: [unlocked.slug],
            locked: true,
          })
        ) {
          await exercise.sync();
        }
        console.log(messages.exercise(unlocked.slug).unlocked);
      }
    }
    return true;
  }

  async publish(): Promise<boolean> {
    console.debug(this.exercise.messages.publish.progress);

    await this.sync();
    {
      const iteration = await this.iteration();
      if ((await this.published()) && await iteration?.published()) {
        console.log(this.exercise.messages.publish.skip);
        return true;
      }
    }

    if (!(await this.complete())) {
      return false;
    }

    if (!(await this.published())) {
      await this.app.api.publish(this);
      await this.sync();
      if (!(await this.published())) {
        console.error(this.exercise.messages.publish.failure);
        return false;
      }
    }

    {
      const iteration = await this.iteration();
      if (!iteration || !(await iteration.publish())) {
        return false;
      }
    }

    console.log(this.exercise.messages.publish.success);
    return true;
  }

  async update(): Promise<boolean> {
    console.debug(this.exercise.messages.update.progress);

    await this.sync();
    if (!(await this.outdated())) {
      console.warn(this.exercise.messages.update.skip);
      return true;
    }

    await this.app.api.update(this);
    await this.sync();
    const iteration = await this.iteration();
    await iteration?.sync();
    if (await iteration?.failing()) {
      console.warn(this.exercise.messages.update.successWithFailedTests);
      return true;
    }

    console.log(this.exercise.messages.update.success);
    return true;
  }

  override async data(options: CacheGetOptions = {}): Promise<SolutionData> {
    return await this.app.api.solution(this, options);
  }
}
