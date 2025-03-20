// deno-lint-ignore-file no-console
import { join } from "@std/path";
import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type { ExerciseData, TrackData } from "./data.ts";
import { ApiElement } from "./data.ts";
import { CommandFailed } from "./error.ts";
import { Exercise, type ExerciseFilter } from "./exercise.ts";
import { messages } from "./strings.ts";
import { type Toolchain, TOOLCHAINS } from "./toolchain.ts";
import type { Tracks } from "./tracks.ts";

export class Track extends ApiElement<TrackData> {
  readonly app: App;
  readonly messages: ReturnType<typeof messages.track>;

  constructor(
    readonly tracks: Tracks,
    readonly slug: string,
  ) {
    super();
    this.app = tracks.app;
    this.messages = messages.track(slug);
  }

  get path(): string {
    return join(this.app.options.workspace, this.slug);
  }

  override async url(): Promise<string> {
    return (await this.data()).web_url ?? this.app.urls.track(this);
  }

  async iconUrl(): Promise<string> {
    return (await this.data()).icon_url ?? "";
  }

  async title(): Promise<string> {
    return (await this.data()).title ?? this.slug;
  }

  async isJoined(): Promise<boolean> {
    return (await this.data()).is_joined ?? false;
  }

  async completed(): Promise<boolean> {
    return (
      (await this.isJoined()) &&
      (await this.numExercises()) === (await this.numCompletedExercises())
    );
  }

  async numExercises(): Promise<number> {
    return (await this.data()).num_exercises ?? 0;
  }

  async numCompletedExercises(): Promise<number> {
    return (await this.data()).num_completed_exercises ?? 0;
  }

  async hasNotifications(): Promise<boolean> {
    return (await this.data()).has_notifications ?? false;
  }

  toolchain(): Toolchain | null {
    return TOOLCHAINS[this.slug] ?? null;
  }

  async matches(filter: TrackFilter): Promise<boolean> {
    return !!(
      (filter.track
        ?.map((track) => new RegExp(`^${track.replaceAll("*", ".*")}$`))
        .some((f) => f.test(this.slug)) ??
        true) &&
      (filter.all ?? (await this.isJoined())) &&
      (!(filter.completed ?? false) || (await this.completed()))
    );
  }

  async *exercises(): AsyncGenerator<Exercise> {
    for (const data of (await this.data()).exercises) {
      if (data.slug !== undefined) {
        yield new Exercise(this, data.slug);
      }
    }
  }

  async *find(filter: ExerciseFilter): AsyncGenerator<Exercise> {
    for await (const exercise of this.exercises()) {
      if (await exercise.matches(filter)) {
        yield exercise;
      }
    }
  }

  override async data(
    options: CacheGetOptions = {},
  ): Promise<TrackData & { exercises: ExerciseData[] }> {
    const track = (await this.tracks.data(options)).find(
      (track) => track.slug === this.slug,
    );
    if (!track) {
      console.error(this.messages.notFound);
      throw new CommandFailed("data");
    }
    const exercises = await this.app.api.exercises(this, options);
    return { ...track, exercises };
  }
}

export interface TrackFilter {
  track?: string[];
  all?: boolean;
  completed?: boolean;
}
