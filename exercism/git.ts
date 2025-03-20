// deno-lint-ignore-file no-console
import { copy, expandGlob } from "@std/fs";
import { join } from "@std/path";
import type { App } from "./app.ts";
import { Config } from "./config.ts";
import { Shell } from "./shell.ts";
import { generated, messages } from "./strings.ts";

class Repo extends Config {
  constructor(readonly git: GitUpdater) {
    super(git.app.cache, "repo", messages.git.repo);
  }

  async validate(repo: string): Promise<boolean> {
    return await new GitClient().validate(repo);
  }
}

export class GitUpdater {
  readonly repo;

  constructor(readonly app: App) {
    this.repo = new Repo(this);
  }

  async update(
    options: { branch?: string; dryRun?: boolean } = {},
  ): Promise<boolean> {
    const repo = await this.repo.get({ cacheOnly: false });
    const dryRun = options.dryRun ?? false;
    const msg = messages.git.update(repo, dryRun);
    const repoDirectory = await Deno.makeTempDir();
    const git = new GitClient({ cwd: repoDirectory, ...options });

    console.debug(msg.progress);

    try {
      await git.clone(repo);
      await this.edit(git, repoDirectory);
      await git.add(".");

      const index = await git.index();
      index.deleted.forEach((f) => console.info(messages.file(f).delete));
      index.added.forEach((f) => console.info(messages.file(f).add));
      index.renamed.forEach((f) => console.info(messages.file(f).rename));
      index.modified.forEach((f) => console.info(messages.file(f).modify));

      if (index.count > 0) {
        await git.commit(generated.git.commitMessage);
        await git.push(options);
        console.log(msg.success);
      } else {
        console.warn(msg.noChange);
      }
      return true;
    } catch {
      console.error(msg.failure);
      return false;
    } finally {
      await Deno.remove(repoDirectory, { recursive: true });
    }
  }

  private async edit(git: GitClient, repoDirectory: string): Promise<void> {
    for await (const track of this.app.tracks.find({})) {
      await Deno.mkdir(join(repoDirectory, track.slug), { recursive: true });
    }
    const allTracks = await Array.fromAsync(this.app.tracks.all());
    await this.cleanup(
      git,
      repoDirectory,
      "*/",
      [".git", ...allTracks.map((track) => track.slug)],
    );
    for await (const track of this.app.tracks.find({})) {
      const repoTrackDirectory = join(repoDirectory, track.slug);
      const allExercises = await Array.fromAsync(track.exercises());
      await copy(track.path, repoTrackDirectory, { overwrite: true });
      await this.cleanup(
        git,
        repoTrackDirectory,
        "*",
        allExercises.map((exercise) => exercise.slug),
      );
    }
    await Deno.writeTextFile(
      join(repoDirectory, generated.git.readme.filename),
      await generated.git.readme.content(this.app.profile, this.app.tracks),
    );
  }

  private async cleanup(
    git: GitClient,
    root: string,
    pattern: string,
    exclude: string[],
  ): Promise<void> {
    for await (const found of expandGlob(pattern, { root, exclude })) {
      await git.rm(found.path);
    }
  }
}

export class GitClient {
  readonly shell: Shell;

  constructor(
    readonly options: { cwd?: string; branch?: string } = {},
  ) {
    this.shell = new Shell({ ...options });
  }

  async init(): Promise<void> {
    await this.shell.run("git", "init", "-q");
  }

  async validate(repo?: string): Promise<boolean> {
    try {
      await this.shell.run("git", "ls-remote", ...(repo ? [repo] : []));
      return true;
    } catch {
      return false;
    }
  }

  async config(key: string, value: string): Promise<void> {
    await this.shell.run("git", "config", key, value);
  }

  async clone(repo: string): Promise<void> {
    const branchArgs = this.options.branch
      ? ["--branch", this.options.branch]
      : [];
    await this.shell.run("git", "clone", "-q", repo, ".", ...branchArgs);
  }

  async add(path: string): Promise<void> {
    await this.shell.run("git", "add", path);
  }

  async rm(path: string): Promise<void> {
    await this.shell.run("git", "rm", "-qr", path);
  }

  async index(): Promise<{
    count: number;
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: string[];
  }> {
    const status = await this.shell.run("git", "status", "--short");
    const index = status.split("\n").filter((line) => line);
    const count = index.length;
    const [added, modified, deleted, renamed]: [
      string[],
      string[],
      string[],
      string[],
    ] = [[], [], [], []];
    for (const line of index) {
      const change = /^\s*([A-Z]+)\s+(.*)\s*$/.exec(line);
      if (change !== null && change.length === 3) {
        if (!change[2]) continue;
        if (change[1] === "D") deleted.push(change[2]);
        else if (change[1] === "A") added.push(change[2]);
        else if (change[1] === "R") renamed.push(change[2]);
        else modified.push(change[2]);
      }
    }
    return { count, added, modified, deleted, renamed };
  }

  async commit(message: string): Promise<void> {
    await this.shell.run("git", "commit", "-qm", message);
  }

  async reset(): Promise<void> {
    await this.shell.run("git", "reset", "--hard", "-q");
  }

  async push(options: { dryRun?: boolean } = {}): Promise<void> {
    const dryRunArgs = options.dryRun ? ["--dry-run"] : [];
    await this.shell.run("git", "push", "-q", ...dryRunArgs);
  }

  async log(): Promise<string[]> {
    return (await this.shell.run("git", "log", "--oneline", "--decorate=short"))
      .split("\n");
  }
}
