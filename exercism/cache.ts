import type { App } from "./app.ts";

export interface CacheGetOptions {
  skipCache?: boolean;
  cacheOnly?: boolean;
}

export interface CacheSetOptions {
  expireIn?: number;
}

export class Cache {
  private kv: Deno.Kv | undefined;

  constructor(readonly app: App) {}

  new<T>(
    key: Deno.KvKey,
    fetcher: () => Promise<T>,
    options: CacheSetOptions = {},
  ): Cached<T> {
    return new Cached(this, key, fetcher, options);
  }

  async get<T>(key: Deno.KvKey): Promise<T | null> {
    await this.open();
    return (await this.kv?.get<T>(key))?.value ?? null;
  }

  async set<T>(
    key: Deno.KvKey,
    value: T,
    options: CacheSetOptions,
  ): Promise<void> {
    await this.open();
    await this.kv?.set(key, value, options);
  }

  async delete(key: Deno.KvKey): Promise<void> {
    await this.open();
    await this.kv?.delete(key);
  }

  private async open(): Promise<void> {
    if (!this.kv) {
      this.kv = await Deno.openKv(this.app.options.cachePath);
    }
  }

  close(): void {
    this.kv?.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}

export class Cached<T> {
  constructor(
    readonly cache: Cache,
    readonly key: Deno.KvKey,
    readonly fetcher: () => Promise<T>,
    readonly options: CacheSetOptions = {},
  ) {}

  async get(options?: { cacheOnly: false }): Promise<T>;
  async get(options: CacheGetOptions): Promise<T | null>;
  async get({
    skipCache = false,
    cacheOnly = false,
  }: CacheGetOptions = {}): Promise<T | null> {
    if (!skipCache) {
      const data = await this.cache.get<T>(this.key);
      if (data !== null) {
        return data;
      }
    }

    if (!cacheOnly) {
      const value = await this.fetcher();
      await this.set(value);
      return value;
    }

    return null;
  }

  async set(data: T): Promise<void> {
    await this.cache.set(this.key, data, this.options);
  }

  async delete(): Promise<void> {
    await this.cache.delete(this.key);
  }
}
