// deno-lint-ignore-file no-console
import { type Cache, Cached } from "./cache.ts";
import { InvalidConfig } from "./error.ts";

export abstract class Config extends Cached<string> {
  constructor(
    cache: Cache,
    key: string,
    readonly messages: {
      prompt: string;
      missing: string;
      invalid: string;
    },
  ) {
    super(cache, ["config", key], async () => await this.prompt());
  }

  async prompt(): Promise<string> {
    const value = prompt(this.messages.prompt);
    if (value === null) {
      console.error(this.messages.missing);
      throw new InvalidConfig(this.key.join(":"));
    }
    return await Promise.resolve(value);
  }

  override async set(value: string): Promise<void> {
    if ((await this.get({ cacheOnly: true })) === value) {
      return;
    }
    if (!(await this.validate(value))) {
      console.error(this.messages.invalid);
      throw new InvalidConfig(this.key.join(":"));
    }
    await super.set(value);
  }

  abstract validate(value: string): Promise<boolean>;
}
