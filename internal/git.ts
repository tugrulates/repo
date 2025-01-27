import { pick } from "@std/collections";

/** Details of a commit using conventional commits. */
export interface Commit {
  /** Full commit hash. */
  hash: string;
  /** Full commit title. */
  title: string;
  /** Conventional commit type. */
  type: string | undefined;
  /** Modules affected by the commit. */
  modules: string[];
  /** Whether the commit is a breaking change. */
  breaking: boolean;
}

/** Options for running git commands. */
export interface GitOptions {
  /** Repository to fetch logs from. Default is current working directory/ */
  repo?: string;
}

const LOG_FORMAT = "--format=%H %s";
const COMMIT_PATTERN =
  /^(?<hash>[a-f0-9]+) (?<title>(?:(?<type>[a-z]+)(?:\((?<modules>[^()]*)\))?(?<breaking>!?):s*)?.+)$/;

function parseCommit(commit: string): Commit {
  const match = commit.match(COMMIT_PATTERN);
  if (!match?.groups?.hash || !match.groups.title) {
    throw new Error(`Cannot parse commit: ${commit}`);
  }
  return {
    hash: match.groups.hash,
    title: match.groups.title,
    type: match.groups.type,
    modules: match.groups.modules?.split(",").map((m) => m.trim()) ?? [],
    breaking: !!match.groups.breaking,
  };
}

function commitRef(commit: Commit | string): string {
  return typeof commit === "string" ? commit : commit.hash;
}

/** Initialize a git repository. */
export async function gitInit(options?: GitOptions): Promise<void> {
  await run(["init"], options);
}

/** Options for creating git commits. */
export interface GitCommitOptions extends GitOptions {
  /** Commit message. */
  message: string;
  /** Files to add to commit. */
  add?: string[];
  /** Files to remove during commit. */
  remove?: string[];
}

/**
 * Create a git commit with a message and optional files.
 *
 * If no files are provided, the commit will automatically stage changes for files in the repo.
 */
export async function gitCommit(options: GitCommitOptions): Promise<Commit> {
  const args = ["commit", "-m", options.message];
  if (options.add) await run(["add", ...options.add], options);
  if (options.remove) await run(["rm", ...options.remove], options);
  if (!options.add && !options.remove) args.push("--allow-empty", "-a");
  await run(args, options);
  const [commit] = await gitLog(pick(options, ["repo"]));
  if (!commit) throw new Error("Cannot find created commit");
  return commit;
}

/** Options for fetching git logs. */
export interface GitLogOptions extends GitOptions {
  /** Path expression to filter commits. Default is all paths. */
  path?: string;
  /** Substring matching a line in the file. Default is all lines. */
  line?: string;
  /** Commit to start search from. Default is the first commit. */
  from?: Commit | string;
}

/** Run git log on a repository, either in full or for a path. */
export async function gitLog(options?: GitLogOptions): Promise<Commit[]> {
  const args = ["log", "-s", LOG_FORMAT];
  if (options?.from) args.push(`${commitRef(options.from)}..HEAD`);
  if (options?.line) args.push(`-S${options.line}`);
  if (options?.path) args.push("--", options.path);
  const log = await run(args, options);
  return log.split("\n").map(parseCommit);
}

/** Options for creating tags. */
export interface GitTagOptions extends GitOptions {
  /** Commit to tag. Default is HEAD. */
  commit?: Commit | string;
  /** Tag message. */
  message?: string;
}

/** Create a git tag with a name and optional message. */
export async function gitTag(
  name: string,
  options?: GitTagOptions,
): Promise<void> {
  const args = ["tag", name];
  if (options?.commit) args.push(commitRef(options.commit));
  if (options?.message) args.push("-m", options.message);
  await run(args, options);
}

/** Options for listing tags. */
export interface GitListTagsOptions extends GitOptions {
  /** Tag selection pattern. Default is all tags. */
  name?: string;
}

/** List all tags in a repository. */
export async function gitListTags(
  options?: GitListTagsOptions,
): Promise<string[]> {
  const args = ["tag", "-l"];
  if (options?.name) args.push(options.name);
  const log = await run(args, options);
  return log.split("\n").filter((tag) => tag);
}

async function run(args: string[], options?: GitOptions): Promise<string> {
  const command = new Deno.Command("git", {
    args,
    cwd: options?.repo ?? ".",
    stdout: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  if (code === 0) {
    return new TextDecoder().decode(stdout).trim();
  } else {
    throw new Error(new TextDecoder().decode(stderr));
  }
}
