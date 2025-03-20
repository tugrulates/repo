import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import { ApiElement, type ProfileData } from "./data.ts";

export class Profile extends ApiElement<ProfileData> {
  constructor(readonly app: App) {
    super();
  }

  async url(): Promise<string> {
    return this.app.urls.profile(await this.handle());
  }

  async handle(): Promise<string> {
    return (await this.data()).handle ?? "";
  }

  async reputation(): Promise<number> {
    return (await this.data()).total_reputation ?? 0;
  }

  override async data(
    options: CacheGetOptions = {},
  ): Promise<ProfileData> {
    return {
      ...(await this.app.api.user(options)),
      ...(await this.app.api.reputation(options)),
    };
  }
}
