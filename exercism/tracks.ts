import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type { TrackData } from "./data.ts";
import { ApiElement } from "./data.ts";
import { Track, type TrackFilter } from "./track.ts";

export class Tracks extends ApiElement<TrackData[]> {
  constructor(readonly app: App) {
    super();
  }

  url(): string {
    return this.app.urls.tracks();
  }

  async *all(): AsyncGenerator<Track> {
    const sorted = (await this.data()).sort(
      (a, b) =>
        (b.num_completed_exercises ?? 0) / (b.num_exercises ?? 1) -
        (a.num_completed_exercises ?? 0) / (a.num_exercises ?? 1),
    );
    for (const data of sorted) {
      if (data.slug !== undefined) {
        yield new Track(this, data.slug);
      }
    }
  }

  async *find(filter: TrackFilter): AsyncGenerator<Track> {
    for await (const track of this.all()) {
      if (await track.matches(filter)) {
        yield track;
      }
    }
  }

  override async data(options: CacheGetOptions = {}): Promise<TrackData[]> {
    return await this.app.api.tracks(options);
  }
}
