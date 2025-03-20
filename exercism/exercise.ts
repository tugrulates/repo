// deno-lint-ignore-file no-console
import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type { ExerciseData } from "./data.ts";
import { ApiElement } from "./data.ts";
import { CommandFailed } from "./error.ts";
import type { Files } from "./files.ts";
import { Solution } from "./solution.ts";
import { messages } from "./strings.ts";
import type { Track } from "./track.ts";

export class Exercise extends ApiElement<ExerciseData> {
  readonly app: App;
  readonly messages: ReturnType<typeof messages.exercise>;

  constructor(
    readonly track: Track,
    readonly slug: string,
  ) {
    super();
    this.app = track.app;
    this.messages = messages.exercise(this.slug);
  }

  override async url(): Promise<string> {
    const link = (await this.data()).links?.self;
    return link !== undefined
      ? this.app.urls.url(link)
      : this.app.urls.exercise(this);
  }

  async difficulty(): Promise<"easy" | "medium" | "hard" | undefined> {
    return (await this.data()).difficulty;
  }

  async title(): Promise<string> {
    return (await this.data()).title ?? this.slug;
  }

  async blurb(): Promise<string> {
    return (await this.data()).blurb ?? this.slug;
  }

  async unlocked(): Promise<boolean> {
    return (await this.data()).is_unlocked ?? false;
  }

  async started(): Promise<boolean> {
    return (await this.solution()) !== null;
  }

  async solution(): Promise<Solution | null> {
    const solutionUuid = (await this.data()).solution_uuid;
    if (solutionUuid === undefined) return null;
    return new Solution(this, solutionUuid);
  }

  async matches(filter: ExerciseFilter): Promise<boolean> {
    const solution = await this.solution();
    const iteration = await solution?.iteration();
    return !!(
      (filter.exercise
        ?.map((exercise) => new RegExp(`^${exercise.replaceAll("*", ".*")}$`))
        .some((f) => f.test(this.slug)) ??
        true) &&
      (filter.all ?? filter.locked ?? (await this.unlocked())) &&
      (!(filter.locked ?? false) || !(await this.unlocked())) &&
      (!(filter.easy ?? false) || (await this.difficulty()) === "easy") &&
      (!(filter.medium ?? false) || (await this.difficulty()) === "medium") &&
      (!(filter.hard ?? false) || (await this.difficulty()) === "hard") &&
      (!(filter.new ?? false) || !(await this.started())) &&
      (!(filter.started ?? false) || (await this.started())) &&
      (!(filter.completed ?? false) ||
        ((await solution?.completed()) ?? false)) &&
      (!(filter.published ?? false) ||
        ((await iteration?.published()) ?? false)) &&
      (!(filter.draft ?? false) || ((await solution?.isDraft()) ?? false)) &&
      (!(filter.passing ?? false) || ((await iteration?.passing()) ?? false)) &&
      (!(filter.failing ?? false) || ((await iteration?.failing()) ?? false)) &&
      (!(filter.feedback ?? false) ||
        ((await iteration?.hasAutomatedFeedback()) ?? false)) &&
      (!(filter.outdated ?? false) ||
        ((await solution?.outdated()) ?? false)) &&
      (!(filter.starred ?? false) || ((await solution?.stars()) ?? 0) > 0) &&
      (!(filter.commented ?? false) || ((await solution?.comments()) ?? 0) > 0)
    );
  }

  async start(): Promise<boolean> {
    console.debug(this.messages.start.progress);

    await this.sync();
    if (await this.started()) {
      console.debug(this.messages.start.skip);
      return true;
    }

    if (!(await this.track.isJoined())) {
      console.error(this.track.messages.notJoined);
      return false;
    }

    await this.app.api.start(this);
    await this.sync();
    if (!(await this.started())) {
      console.error(this.messages.start.failure);
      return false;
    }

    console.log(this.messages.start.success);
    return true;
  }

  async setup(): Promise<Files> {
    if (!((await this.started()) || (await this.start()))) {
      throw new CommandFailed("setup");
    }
    const solution = await this.solution();
    if (!solution || !(await solution.files.setup())) {
      throw new CommandFailed("setup");
    }
    return solution.files;
  }

  async submit({
    force = false,
    complete = false,
    publish = false,
  } = {}): Promise<boolean> {
    await this.sync();
    const solution = await this.solution();
    if (!solution) {
      console.error(this.messages.notStarted);
      return false;
    }
    if (!(await solution.submit({ force }))) {
      return false;
    }
    if (complete && !(await this.complete())) {
      return false;
    }
    if (publish && !(await this.publish())) {
      return false;
    }
    return true;
  }

  async complete(): Promise<boolean> {
    await this.sync();
    const solution = await this.solution();
    if (!solution) {
      console.error(this.messages.notStarted);
      return false;
    }
    return await solution.complete();
  }

  async publish(): Promise<boolean> {
    await this.sync();
    const solution = await this.solution();
    if (!solution) {
      console.error(this.messages.notStarted);
      return false;
    }
    return await solution.publish();
  }

  async update(): Promise<boolean> {
    await this.sync();
    const solution = await this.solution();
    if (!solution) {
      console.error(this.messages.notStarted);
      return false;
    }
    return await solution.update();
  }

  override async data(options: CacheGetOptions = {}): Promise<ExerciseData> {
    const data = await this.app.api.exercises(this.track, options);
    const exercise = data.find((exercise) => exercise.slug === this.slug);
    if (!exercise) {
      console.error(this.messages.notFound);
      throw new CommandFailed("data");
    }
    return exercise;
  }
}

export interface ExerciseFilter {
  exercise?: string[];
  all?: boolean;
  locked?: boolean;
  easy?: boolean;
  medium?: boolean;
  hard?: boolean;
  new?: boolean;
  started?: boolean;
  completed?: boolean;
  published?: boolean;
  draft?: boolean;
  passing?: boolean;
  failing?: boolean;
  feedback?: boolean;
  outdated?: boolean;
  starred?: boolean;
  commented?: boolean;
}
