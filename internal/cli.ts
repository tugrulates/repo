import { parseFlags } from "@cliffy/flags";
import { Input, Secret } from "@cliffy/prompt";
import { basename, dirname } from "@std/path";

const CONFIG_PATH = `${Deno.env.get("HOME")}/.scripts/config.db`;

/**
 * A string configuration option for CLI.
 *
 * Options are cached in a key-value store, and not prompted if already set.
 */
export class Config {
  private key: [string, string];

  /**
   * Create a new configuration option.
   *
   * @param name Name, and also the cache key, of the option.
   * @param options Configuration options.
   * @param options.secret Whether the option is a secret.
   */
  constructor(
    readonly name: string,
    readonly options: { value?: string; secret?: boolean } = {},
  ) {
    this.key = [basename(dirname(Deno.mainModule)), name];
  }

  /**
   * Create a required cliffy option for the configuration.
   *
   * If the value is already in the cache, it is used as the default.
   *
   * @returns A cliffy option object.
   */
  async option(): Promise<
    {
      value: (value: string) => Promise<string>;
      default?: string;
    }
  > {
    const value = async (value: string) => {
      await this.set(value);
      return await this.get();
    };
    const defaultValue = await this.get(false);
    if (!defaultValue) return { value };
    return { value, default: defaultValue };
  }

  /**
   * Get the configuration value.
   *
   * If the value is not in the cache, it is prompted.
   *
   * @returns The configuration value, prompted until set.
   */
  async get(): Promise<string>;

  /**
   * Get the configuration value.
   *
   * The value is prompted if not in the cache and `prompt` is `true`.
   *
   * @param prompt Whether to prompt for the value if not in the cache.
   * @returns The configuration value if available, undefined otherwise.
   */
  async get(prompt: boolean): Promise<string | undefined>;
  async get(prompt = true): Promise<string | undefined> {
    const kv = await Deno.openKv(CONFIG_PATH);
    try {
      let value = parseFlags(Deno.args).flags[this.name] as string | undefined;
      if (!value) {
        value = (await kv.get(this.key)).value as string | undefined;
      }
      if (prompt) {
        while (!value) {
          value = await (this.options.secret ? Secret : Input).prompt(
            this.name,
          );
        }
        await this.set(value);
      }
      return value ?? undefined;
    } finally {
      kv.close();
    }
  }

  /**
   * Set the configuration value in the cache.
   *
   * @param value The value to set.
   */
  async set(value: string): Promise<void> {
    const kv = await Deno.openKv(CONFIG_PATH);
    try {
      await kv.set(this.key, value);
    } finally {
      kv.close();
    }
  }

  /**
   * Clear the configuration value from the cache.
   *
   * @returns A promise that resolves when the value is cleared.
   */
  async clear(): Promise<void> {
    const kv = await Deno.openKv(CONFIG_PATH);
    try {
      await kv.delete(this.key);
    } finally {
      kv.close();
    }
  }
}
