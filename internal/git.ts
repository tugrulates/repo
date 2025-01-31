import { pick } from "@std/collections";

/** Details of a commit using conventional commits. */
export interface Commit {
  /** Full commit hash. */
  hash: string;
  /** Commit author. */
  author: string;
  /** Commit message title. */
  title: string;
  /** Commit message body. */
  body: string;
  /** Conventional commit type. */
  type: string | undefined;
  /** Modules affected by the commit. */
  modules: string[];
  /** Whether the commit is a breaking change. */
  breaking: boolean;
}

/** Options for running git commands. */
export interface GitOptions {
  /** Local repository directory to manage. Default is current working directory. */
  dir?: string;
}

function commitRef(commit: Commit | string): string {
  return typeof commit === "string" ? commit : commit.hash;
}

/** Author or committer. */
export interface GitUser {
  /** Name of the user. */
  name?: string;
  /** E-mail of the user. */
  email?: string;
}

export async function gitUser(
  user: GitUser,
  options?: GitOptions,
): Promise<void> {
  if (user.name) await run(["config", "user.name", user.name], options);
  if (user.email) await run(["config", "user.email", user.email], options);
}

/** Options for initializing repositories. */
export interface GitInitOptions extends GitOptions {
  /** Committer and default author for the repository. */
  user?: GitUser;
  /** Whether to create a bare repository. */
  bare?: boolean;
}

/** Initializes an empty git repository. */
export async function gitInit(options?: GitInitOptions): Promise<void> {
  const args = ["init"];
  if (options?.bare) args.push("--bare");
  await run(args, options);
  if (options?.user) await gitUser(options.user, options);
}

/** Options for checkout. */
export interface GitCheckoutOptions extends GitOptions {
  /** Checkout at given commit or reference. Default is HEAD. */
  commit?: Commit | string;
  /** Branch to create and checkout during checkout. */
  newBranch?: string;
}

/** Checks out given commit or branch. */
export async function gitCheckout(options?: GitCheckoutOptions): Promise<void> {
  const args = ["checkout"];
  if (options?.newBranch) args.push("-b", options.newBranch);
  if (options?.commit) args.push(commitRef(options.commit));
  await run(args, options);
}

/** Returns the current branch name. */
export async function gitCurrentBranch(
  options?: GitOptions,
): Promise<string | undefined> {
  const branch = await run(["branch", "--show-current"], options);
  return branch ? branch : undefined;
}

/** Options for creating git commits. */
export interface GitCommitOptions extends GitOptions {
  /** Commit message. */
  message: string;
  /** Commit author. */
  author?: string;
  /** Files to add to commit. */
  add?: string[];
  /** Files to remove during commit. */
  remove?: string[];
}

/**
 * Creates a git commit with a message and optional files.
 *
 * If no files are provided, the commit will automatically stage changes for files in the repo.
 */
export async function gitCommit(options: GitCommitOptions): Promise<Commit> {
  await Promise.all([
    options.add ? run(["add", ...options.add], options) : {},
    options.remove ? run(["rm", ...options.remove], options) : {},
  ]);

  const args = ["commit", "-m", options.message];
  if (options.author) args.push("--author", options.author);
  if (!options.add && !options.remove) args.push("--allow-empty", "-a");
  await run(args, options);
  const [commit] = await gitLog(pick(options, ["dir"]));
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
  /** Commit to end search at. Default is HEAD. */
  to?: Commit | string;
  /** Only retrieve commits from an author. */
  author?: string;
}

const TITLE_PATTERN =
  /^(?<title>(?:(?<type>[a-z]+)(?:\((?<modules>[^()]*)\))?(?<breaking>!?):s*)?.+)$/;

function parseLog(log: string): Omit<Commit, "body"> {
  const [hash, author, title] = log.split("\n");
  if (!hash || !author || !title) {
    throw new Error(`Cannot parse commit log: ${log}`);
  }
  const match = title?.match(TITLE_PATTERN);
  return {
    hash,
    author,
    title,
    type: match?.groups?.type,
    modules: match?.groups?.modules?.split(",").map((m) => m.trim()) ?? [],
    breaking: !!match?.groups?.breaking,
  };
}

/** Runs git log on a repository, either in full or for a path. */
export async function gitLog(options?: GitLogOptions): Promise<Commit[]> {
  const args = ["log", "-s", "--format=%H%n%an <%ae>%n%s%n"];
  if (options?.from) {
    args.push(`${commitRef(options.from)}...${options.to ?? "HEAD"}`);
  } else if (options?.to) args.push(commitRef(options.to));
  if (options?.line) args.push(`-S${options.line}`, "-E");
  if (options?.path) args.push("--", options.path);
  if (options?.author) args.push("--author", options.author);
  const log = await run(args, options);
  const commits = log.split("\n\n").filter((c) => c).map(parseLog);
  return await Promise.all(commits.map(async (commit) => {
    const body = await run(["show", "-s", "--format=%b", commit.hash], options);
    return { ...commit, body };
  }));
}

/** Options for creating tags. */
export interface GitTagOptions extends GitOptions {
  /** Commit to tag. Default is HEAD. */
  commit?: Commit | string;
  /** Tag message. */
  message?: string;
  /** Replace existing tags instead of failing. */
  force?: boolean;
}

/** Creates a git tag with a name and optional message. */
export async function gitTag(
  name: string,
  options?: GitTagOptions,
): Promise<void> {
  const args = ["tag", name];
  if (options?.commit) args.push(commitRef(options.commit));
  if (options?.message) args.push("-m", options.message);
  if (options?.force) args.push("--force");
  await run(args, options);
}

/** Options for listing tags. */
export interface GitListTagsOptions extends GitOptions {
  /** Tag selection pattern. Default is all tags. */
  name?: string;
  /** Commit to start search from. Default is the first commit. */
  from?: Commit | string;
  /** Commit to end search at. Default is HEAD. */
  to?: Commit | string;
  /**
   * Sort option.
   *
   * Setting to `version` uses semver order, returning latest versions first.
   *
   * @todo Handle pre-release versions.
   */
  sort?: "version";
}

/** Lists all tags in a repository. */
export async function gitListTags(
  options?: GitListTagsOptions,
): Promise<string[]> {
  const args = ["tag", "-l"];
  if (options?.name) args.push(options.name);
  if (options?.from) args.push("--no-merged", commitRef(options.from));
  if (options?.to) args.push("--merged", commitRef(options.to));
  if (options?.sort === "version") args.push("--sort", "-version:refname");
  const log = await run(args, options);
  return log.split("\n").filter((tag) => tag);
}

async function run(args: string[], options?: GitOptions): Promise<string> {
  const command = new Deno.Command("git", {
    args,
    cwd: options?.dir ?? ".",
    stdout: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  if (code === 0) {
    return new TextDecoder().decode(stdout).trim();
  } else {
    console.error(`Error running git command: git ${args.join(" ")}`);
    throw new Error(new TextDecoder().decode(stderr));
  }
}

/** Options for adding or querying remotes. */
export interface GitRemoteOptions extends GitOptions {
  /** Remote name. Default is origin. */
  remote?: string;
}

/** Clones a git repository from remote URL. */
export async function gitClone(
  url: string,
  options?: GitRemoteOptions & GitInitOptions,
): Promise<void> {
  const args = ["clone", url];
  if (options?.remote) args.push("--origin", options.remote);
  if (options?.dir) args.push(options.dir);
  await run(args, options);
  if (options?.user) await gitUser(options.user, options);
}

/** Adds a remote to a repository. */
export async function gitAddRemote(
  url: string,
  options?: GitRemoteOptions,
): Promise<void> {
  const remote = options?.remote ?? "origin";
  const args = ["remote", "add", remote, url];
  await run(args, options);
}

/** Returns remote push url. */
export async function gitRemoteUrl(
  options?: GitRemoteOptions,
): Promise<string> {
  const remote = options?.remote ?? "origin";
  return await run(["remote", "get-url", remote], options);
}

/** Returns remote head branch name. */
export async function gitRemoteBase(
  options?: GitRemoteOptions,
): Promise<string | undefined> {
  const remote = options?.remote ?? "origin";
  const info = await run(["remote", "show", remote], options);
  const match = info.match(/\n\s*HEAD branch:\s*(.+)\s*\n/);
  if (match && match[1]) return match[1];
  return undefined;
}

/** Options for pushing to a remote. */
export interface GitPushOptions extends GitRemoteOptions {
  /** Branch to push. Default is current branch. */
  branch?: string;
  /** Force push to remote. */
  force?: boolean;
}

/** Pushes commits to a remote. */
export async function gitPushCommits(options?: GitPushOptions): Promise<void> {
  const remote = options?.remote ?? "origin";
  const branch = await gitCurrentBranch(options ? pick(options, ["dir"]) : {});
  if (!branch) throw new Error("Cannot determine current branch");
  const args = ["push", remote, "--set-upstream", branch];
  if (options?.force) args.push("--force");
  await run(args, options);
}

/** Pushes a tag to a remote. */
export async function gitPushTag(
  tag: string,
  options?: GitPushOptions,
): Promise<void> {
  const remote = options?.remote ?? "origin";
  const args = ["push", remote, "tag", tag];
  if (options?.force) args.push("--force");
  await run(args, options);
}

/** Pulls commits and tags from a remote. */
export async function gitPull(options?: GitRemoteOptions): Promise<void> {
  const remote = options?.remote ?? "origin";
  await run(["pull", remote], options);
}
