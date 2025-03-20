import type { RetryOptions } from "@std/async";
import open from "open";
import { Api } from "./api.ts";
import { Cache } from "./cache.ts";
import { Config } from "./config.ts";
import { Profile } from "./profile.ts";
import { Shell } from "./shell.ts";
import { messages } from "./strings.ts";
import { Tracks } from "./tracks.ts";
import { Urls } from "./urls.ts";

export const name: string = "exercism";
export const version: string = "0.0.0";

class Token extends Config {
  constructor(readonly app: App) {
    super(app.cache, "token", messages.app.token(app.urls.token()));
  }

  async obfuscated(): Promise<string | null> {
    const token = await this.get({ cacheOnly: true });
    if (token === null) {
      return null;
    }
    return (
      token.slice(0, 2) +
      token.slice(2, -2).replace(/[^-]/g, "*") +
      token.slice(-2)
    );
  }

  async validate(token: string): Promise<boolean> {
    return await this.app.api.validateToken(token);
  }
}

export interface AppOptions {
  endpoint: string;
  workspace: string;
  cachePath?: string;
  retry?: RetryOptions;
}

export class App {
  readonly urls: Urls;
  readonly cache: Cache;
  readonly token: Token;
  readonly api: Api;
  readonly profile: Profile;
  readonly tracks: Tracks;

  constructor(readonly options: AppOptions) {
    this.urls = new Urls(this);
    this.cache = new Cache(this);
    this.token = new Token(this);
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
