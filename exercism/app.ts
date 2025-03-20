import type { RetryOptions } from "@std/async";
import open from "open";
import { Api } from "./api.ts";
import { Cache } from "./cache.ts";
import { Profile } from "./profile.ts";
import { Shell } from "./shell.ts";
import { Tracks } from "./tracks.ts";
import { Urls } from "./urls.ts";

export const name: string = "exercism";
export const version: string = "0.0.0";

export interface AppOptions {
  endpoint: string;
  token: string;
  workspace: string;
  cachePath?: string;
  retry?: RetryOptions;
}

export class App {
  readonly urls: Urls;
  readonly cache: Cache;
  readonly token: string;
  readonly api: Api;
  readonly profile: Profile;
  readonly tracks: Tracks;

  constructor(readonly options: AppOptions) {
    this.urls = new Urls(this);
    this.cache = new Cache(this);
    this.token = options.token;
    this.api = new Api(this);
    this.profile = new Profile(this);
    this.tracks = new Tracks(this);
  }

  async code(files: string[], { diff = false } = {}): Promise<void> {
    const diffOpts = diff ? ["--wait", "--diff"] : [];
    await new Shell({ cwd: this.options.workspace })
      .run("code", ...diffOpts, ...files);
  }

  open(url: string): void {
    open(url);
  }

  [Symbol.dispose](): void {
    this.cache.close();
  }
}
