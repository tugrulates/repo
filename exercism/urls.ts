import type { App } from "./app.ts";
import type { Exercise } from "./exercise.ts";
import type { Track } from "./track.ts";

export class Urls {
  constructor(readonly app: App) {}

  url(path = ""): string {
    return this.app.options.endpoint + path;
  }

  token(): string {
    return `${this.app.options.endpoint}/settings/api_cli`;
  }

  profile(handle: string): string {
    return `${this.app.options.endpoint}/profiles/${handle}`;
  }

  tracks(): string {
    return `${this.app.options.endpoint}/tracks`;
  }

  track(track: Track): string {
    return `${this.app.options.endpoint}/tracks/${track.slug}`;
  }

  exercise(exercise: Exercise): string {
    return `${this.app.options.endpoint}/tracks/${exercise.track.slug}/exercises/${exercise.slug}`;
  }

  solution(exercise: Exercise, handle: string): string {
    return `${this.app.options.endpoint}/tracks/${exercise.track.slug}/exercises/${exercise.slug}/solutions/${handle}`;
  }

  iteration(exercise: Exercise): string {
    return `${this.app.options.endpoint}/tracks/${exercise.track.slug}/exercises/${exercise.slug}/iterations`;
  }
}
