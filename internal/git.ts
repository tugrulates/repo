import { assertGreater } from "@std/assert";
import { assert } from "@std/assert/assert";
import { assertEquals } from "@std/assert/equals";
import { assertFalse } from "@std/assert/false";
import { join } from "@std/path/join";

// NOT IMPLEMENTED
// - most configs
// - merge, rebase, conflict resolution
// - stash
// - submodules
// - dates
// - verify signatures
// - prune

/** A local repository with git commands. */
export interface Git {
  /** Local repository directory. */
  directory: string;
  /** Returns the full path to a file in the repository. */
  path: (...parts: string[]) => string;
  /** Configures repository options. */
  config: (config: GitConfig) => Promise<void>;
  /** Initializes a new git repository. */
  init: (options?: GitInitOptions) => Promise<void>;
  /** Clones a remote repository. */
  clone: (url: string, options?: GitCloneOptions) => Promise<void>;
  /** Switches to a commit, or an existing or new branch. */
  checkout: (options?: GitCheckoutOptions) => Promise<void>;
  /** Returns the current branch name. */
  branch: () => Promise<string | undefined>;
  /** Stages files for commit. */
  add: (pathspecs: string | string[]) => Promise<void>;
  /** Removes files from the index. */
  remove: (pathspecs: string | string[]) => Promise<void>;
  /** Creates a new commit in the repository. */
  commit: (
    summary: string,
    options?: GitCommitOptions,
  ) => Promise<GitCommit>;
  /** Returns the history of commits in the repository. */
  log: (options?: GitLogOptions) => Promise<GitCommit[]>;
  /** Creates a new tag in the repository. */
  tag: (name: string, options?: GitTagOptions) => Promise<GitTag>;
  /** Lists all tags in the repository. */
  tagList: (options?: GitTagListOptions) => Promise<GitTag[]>;
  /** Adds a remote to the repository. */
  addRemote: (url: string, options?: GitRemoteOptions) => Promise<void>;
  /** Returns the remote repository URL. */
  remote: (options?: GitRemoteOptions) => Promise<string>;
  /** Returns the remote head branch of the repository. */
  remoteBase: () => Promise<string | undefined>;
  /** Pushes commits to a remote. */
  push: (options?: GitPushOptions) => Promise<void>;
  /** Pushes a tag to a remote. */
  pushTag: (tag: string, options?: GitPushTagOptions) => Promise<void>;
  /** Pulls commits and tags from a remote. */
  pull: (options?: GitPullOptions) => Promise<void>;
}

/** A single commit in the Git history. */
export interface GitCommit {
  /** Full hash of commit. */
  hash: string;
  /** Commit summary, the first line of the commit message. */
  summary: string;
  /** Commit body, excluding the first line from the message. */
  body: string;
  /** Author, who wrote the code. */
  author: GitUser;
  /** Committter, who created the commit. */
  committer: GitUser;
}

/** A tag in the Git repository. */
export interface GitTag {
  /** Tag name. */
  name: string;
  /** Tag subject from tag message. */
  subject?: string;
  /** Tag body from tag message. */
  body?: string;
  /** Tagger, who created the tag. */
  tagger?: GitUser;
}

/** A refspec mapping local and remote refs. */
export interface GitRefspec {
  /** Local ref. */
  src: string;
  /** Remote ref. */
  dst: string;
}

/** A revision range. */
export interface GitRange {
  /** Match objects that are descendants of this revision. */
  from?: GitCommit | string;
  /** Match objects that are ancestors of this revision. */
  to?: GitCommit | string;
  /**
   * Match objects that are reachable from either end, but not from both.
   *
   * Ignored if either {@linkcode GitRange.from} or {@linkcode GitRange.to} is
   * not set.
   *
   * {@default false}
   */
  symmetric?: boolean;
}

/** Git configuration options. */
export interface GitConfig {
  /** Commit configuration. */
  commit?: {
    /** Whether to sign commits. */
    gpgsign?: boolean;
  };
  /** Tag configuration. */
  tag?: {
    /** Whether to sign tags. */
    gpgsign?: boolean;
  };
  /** User configuration. */
  user?: Partial<GitUser> & {
    /** GPG key for signing commits. */
    signingkey?: string;
  };
}

/** An author or commiter on git repository. */
export interface GitUser {
  /** Name of the user. */
  name: string;
  /** E-mail of the user. */
  email: string;
}

/** Options for initializing repositories. */
export interface GitInitOptions {
  /**
   * Create a bare repository.
   * @default {false}
   */
  bare?: boolean;
  /**
   * Name of the initial branch.
   *
   * Creates a new branch with this name for {@linkcode Git.init}, and checks out
   * this branch for {@linkcode Git.clone}.
   *
   * Default is `main`, if not overridden with git config.
   */
  branch?: string;
  /**
   * Git configuration options.
   *
   * Configures the new repository after creation for {@linkcode Git.init}, and
   * allows configuring the repository before fetch for {@linkcode Git.clone}.
   */
  config?: GitConfig;
}

/** Options for signing commits and tags. */
export interface GitSignOptions {
  /**
   * Sign the commit with GPG.
   *
   * If `true` or a string, object is signed with the default or given GPG key.
   *
   * If `false`, the commit is not signed.
   */
  sign?: boolean | string;
}

/** Options for cloning repositories. */
export interface GitCloneOptions extends GitInitOptions, GitRemoteOptions {
  /**
   * Number of commits to clone at the tip.
   *
   * Implies {@linkcode GitCloneOptions.singleBranch} unless it is set to
   * `false` to fetch from the tip of all branches.
   */
  depth?: number;
  /**
   * Bypasses local transport optimization when set to `false`.
   *
   * When the remote repository is specified as a URL, this is ignored,
   * otherwise it is implied.
   */
  local?: boolean;
  /** Clone only tip of a single branch.
   *
   * The cloned branch is either remote `HEAD` or
   * {@linkcode GitInitOptions.branch}.
   */
  singleBranch?: boolean;
  /**
   * Fetch tags.
   * @default {true}
   */
  tags?: boolean;
}

/** Options for checkout. */
export interface GitCheckoutOptions {
  /** Checkout at given commit or branch. Default is HEAD. */
  target?: GitCommit | string;
  /** Branch to create and checkout during checkout. */
  newBranch?: string;
  /**
   * Detach `HEAD` during checkout from the target branch.
   * @default {false}
   */
  detach?: boolean;
}

/** Options for creating git commits. */
export interface GitCommitOptions extends GitSignOptions {
  /**
   * Automatically stage modified or deleted files known to git.
   * @default {false}
   */
  all?: boolean;
  /**
   * Allow empty commit.
   * @default {false}
   */
  allowEmpty?: boolean;
  /** Amend the last commit. */
  amend?: boolean;
  /** Author, who wrote the code. */
  author?: GitUser | undefined;
  /** Commit body to append to the message.   */
  body?: string;
}

/** Options for fetching git logs. */
export interface GitLogOptions {
  /** Only commits by an author. */
  author?: GitUser;
  /** Only commits by a committer. */
  committer?: GitUser;
  /** Only commts that any of the given paths. */
  paths?: string[];
  /** Only commits in a range. */
  range?: GitRange;
  /** Maximum number of commits to return. */
  maxCount?: number;
  /** Number of commits to skip. */
  skip?: number;
  /** Only commits that either deleted or added the given text. */
  text?: string;
}

/**
 * Options for creating tags.
 *
 * Creates a lightweight tag by default. If {@linkcode GitTagOptions.subject} or
 * {@linkcode GitTagOptions.body} is set, or if {@linkcode GitSignOptions.sign}
 * is set to `true`, an annotated tag is created.
 */
export interface GitTagOptions extends GitSignOptions {
  /** Commit to tag. Default is HEAD. */
  commit?: GitCommit | string;
  /** Tag message subject. */
  subject?: string;
  /** Tag message body. */
  body?: string;
  /** Replace existing tags instead of failing. */
  force?: boolean;
}

/** Options for listing tags. */
export interface GitTagListOptions {
  /** Tag selection pattern. Default is all tags. */
  name?: string;
  /** Only tags that contain the specific commit. */
  contains?: GitCommit | string;
  /** Only tags that do not contain the specific commit. */
  noContains?: GitCommit | string;
  /**
   * Sort option.
   *
   * Setting to `version` uses semver order, returning latest versions first.
   *
   * @todo Handle pre-release versions.
   */
  sort?: "version";
}

/** Options for adding or querying remotes. */
export interface GitRemoteOptions {
  /** Remote name. @default {"origin"} */
  remote?: string;
}

/** Options for pulling from or pushing to a remote. */
export interface GitTransportOptions {
  /** Either update all refs on the other side, or don't update any.*/
  atomic?: boolean;
  /** Copy all tags.
   *
   * During pull, git only fetches tags that point to the downloaded objects.
   * When this value is set to `true`, all tags are fetched. When it is set to
   * `false`, no tags are fetched.
   *
   * During push, no tags are pushed by default. When this value is set to
   * `true`, all tags are pushed.
   */
  tags?: boolean;
}

/** Options for pushing to a remote. */
export interface GitPushOptions extends GitTransportOptions, GitRemoteOptions {
  /** Remote branch to push to. Default is the tracked remote branch. */
  branch?: string;
  /** Force push to remote. */
  force?: boolean;
}

/** Options for pushing a tag to a remote. */
export interface GitPushTagOptions extends GitRemoteOptions {
  /** Force push to remote. */
  force?: boolean;
}

/** Options for pulling from a remote. */
export interface GitPullOptions
  extends GitRemoteOptions, GitTransportOptions, GitSignOptions {}

/** Options for running working with remote. */
export interface GitRepoOptions {
  /** Local repository directory to manage. @default {Deno.cwd()} */
  directory?: string;
}

/** Creates a new Git instance for a local repository. */
export function gitRepo(options?: GitRepoOptions): Git {
  return {
    directory: options?.directory ?? Deno.cwd(),
    path(...parts: string[]) {
      return join(this.directory, ...parts);
    },
    async init(options?: GitInitOptions) {
      await run(
        this.directory,
        "init",
        options?.bare && "--bare",
        options?.branch !== undefined && ["--initial-branch", options.branch],
      );
      if (options?.config) await this.config(options.config);
    },
    async clone(url: string, options?: GitCloneOptions) {
      await run(
        this.directory,
        ["clone", url, "."],
        options?.local === false && "--no-local",
        options?.local === true && "--local",
        options?.remote !== undefined && ["--origin", options.remote],
        options?.branch !== undefined && ["--branch", options.branch],
        options?.singleBranch === false && "--no-single-branch",
        options?.singleBranch === true && "--single-branch",
        options?.depth !== undefined && ["--depth", `${options.depth}`],
        options?.config !== undefined && configArgs(options?.config)
          .map((c) => ["--config", `${c.key}=${c.value}`]).flat(),
      );
    },
    async config(config: GitConfig) {
      for (const arg of configArgs(config)) {
        await run(this.directory, "config", arg.key, arg.value);
      }
    },
    async checkout(options?: GitCheckoutOptions) {
      await run(
        this.directory,
        "checkout",
        options?.detach && "--detach",
        options?.newBranch !== undefined && ["-b", options.newBranch],
        options?.target !== undefined && committishArg(options.target),
      );
    },
    async branch() {
      const branch = await run(this.directory, "branch", "--show-current");
      return branch ? branch : undefined;
    },
    async add(pathspecs: string | string[]) {
      await run(this.directory, "add", pathspecs);
    },
    async remove(pathspecs: string | string[]) {
      await run(this.directory, "rm", pathspecs);
    },
    async commit(summary: string, options?: GitCommitOptions) {
      await run(
        this.directory,
        "commit",
        ["-m", summary],
        options?.body && ["-m", options?.body],
        options?.all && "--all",
        options?.allowEmpty && "--allow-empty",
        options?.amend && "--amend",
        options?.author && ["--author", userArg(options.author)],
        options?.sign !== undefined && signArg(options.sign, "commit"),
      );
      const [commit] = await this.log({ maxCount: 1 });
      if (!commit) throw new Error("Cannot find created commit");
      return commit;
    },
    async log(options?: GitLogOptions) {
      const output = await run(
        this.directory,
        ["log", `--format=${formatArg(LOG_FORMAT)}`],
        options?.author && ["--author", userArg(options.author)],
        options?.committer && ["--committer", userArg(options.committer)],
        options?.maxCount !== undefined &&
          ["--max-count", `${options.maxCount}`],
        options?.paths && ["--", ...options.paths],
        options?.range !== undefined && rangeArg(options.range),
        options?.skip !== undefined && ["--skip", `${options.skip}`],
        options?.text !== undefined && ["-S", options.text, "--pickaxe-regex"],
      );
      return parseOutput(LOG_FORMAT, output);
    },
    async tag(name: string, options?: GitTagOptions): Promise<GitTag> {
      const isAnnotated = options?.subject !== undefined ||
        options?.body !== undefined ||
        (options?.sign !== undefined && options.sign !== false);
      if (isAnnotated && !(options?.subject)) {
        throw new Error("Annotated tags require a subject");
      }
      await run(
        this.directory,
        ["tag", name],
        options?.commit && committishArg(options.commit),
        options?.subject && ["-m", options.subject],
        options?.body && ["-m", options.body],
        options?.force && "--force",
        options?.sign !== undefined && signArg(options.sign, "tag"),
      );
      const [tag] = await this.tagList({ name });
      assert(tag, "Cannot find created tag");
      return tag;
    },
    async tagList(options?: GitTagListOptions) {
      const output = await run(
        this.directory,
        ["tag", "--list", `--format=${formatArg(TAG_FORMAT)}`],
        options?.name,
        options?.contains !== undefined &&
          ["--contains", committishArg(options.contains)],
        options?.noContains !== undefined &&
          ["--no-contains", committishArg(options.noContains)],
        options?.sort === "version" && "--sort=-version:refname",
      );
      return parseOutput(TAG_FORMAT, output);
    },
    async addRemote(url: string, options?: GitRemoteOptions) {
      await run(
        this.directory,
        ["remote", "add"],
        options?.remote ?? "origin",
        url,
      );
    },
    async remote(options?: GitRemoteOptions) {
      return await run(
        this.directory,
        ["remote", "get-url"],
        options?.remote ?? "origin",
      );
    },
    async remoteBase() { // todo: options?
      const remote = "origin";
      const info = await run(this.directory, "remote", "show", remote);
      const match = info.match(/\n\s*HEAD branch:\s*(.+)\s*\n/);
      if (match && match[1]) return match[1];
      return undefined;
    },
    async push(options?: GitPushOptions) {
      await run(
        this.directory,
        ["push", options?.remote ?? "origin"],
        options?.branch,
        options?.atomic === false && "--no-atomic",
        options?.atomic === true && "--atomic",
        options?.force && "--force",
        options?.tags && "--tags",
      );
    },
    async pushTag(tag: string, options?: GitPushTagOptions) {
      await run(
        this.directory,
        ["push", options?.remote ?? "origin", "tag", tag],
        options?.force && "--force",
      );
    },
    async pull(options?: GitPullOptions) {
      await run(
        this.directory,
        "pull",
        options?.remote,
        options?.atomic && "--atomic",
        options?.sign !== undefined && signArg(options.sign, "commit"),
        options?.tags === false && "--no-tags",
        options?.tags === true && "--tags",
      );
    },
  };
}

async function run(
  cwd: string,
  ...conditionalArgs: (string | string[] | false | undefined)[]
): Promise<string> {
  const args = conditionalArgs
    .filter((x) => x !== false && x !== undefined)
    .flat();
  const command = new Deno.Command("git", { args, cwd, stdout: "piped" });
  const { code, stdout, stderr } = await command.output();
  if (code === 0) {
    return new TextDecoder().decode(stdout).trim();
  } else {
    const command = `git ${
      args.map((x) => `"${x.replace('"', '\\"')}"`).join(" ")
    }`;
    let error = new TextDecoder().decode(stderr).trim();
    if (!error) error = new TextDecoder().decode(stdout).trim();
    if (!error) error = "Unknown error";
    throw new Error(`Error running git command: ${command}\n${error}`);
  }
}

function configArgs(config: GitConfig): { key: string; value: string }[] {
  return Object.entries(config).map(([group, cfg]) =>
    Object.entries(cfg).map(([key, value]) => ({
      key: `${group}.${key}`,
      value: `${value}`,
    }))
  ).flat();
}

function userArg(user: GitUser): string {
  return `${user.name} <${user.email}>`;
}

function committishArg(commit: GitCommit | string): string {
  return typeof commit === "string" ? commit : commit.hash;
}

function signArg(sign: boolean | string, type: "commit" | "tag"): string {
  if (type === "tag") {
    if (sign === false) return "--no-sign";
    if (sign === true) return "--sign";
    return `--local-user=${sign}`;
  }
  if (sign === false) return "--no-gpg-sign";
  if (sign === true) return "--gpg-sign";
  return `--gpg-sign=${sign}`;
}

function rangeArg(range: GitRange): string {
  const from = range.from && committishArg(range.from);
  const to = (range.to && committishArg(range.to)) ?? "HEAD";
  if (from === undefined) return to;
  return `${from}${range.symmetric ? "..." : ".."}${to}`;
}

type FormatField = {
  kind: "string" | "number";
  optional?: boolean;
  format: string;
} | {
  kind: "object";
  optional?: boolean;
  fields: { [key: string]: FormatField };
};

type FormatFieldDescriptor<T> =
  & (T extends object ? {
      kind: "object";
      fields: { [K in keyof T]: FormatFieldDescriptor<T[K]> };
    }
    : {
      kind: T extends string ? "string"
        : T extends number ? "number"
        : never;
      format: string;
    })
  & (undefined extends T ? { optional: true }
    : { optional?: false });

type FormatDescriptor<T> = { delimiter: string } & FormatFieldDescriptor<T>;

const LOG_FORMAT: FormatDescriptor<GitCommit> = {
  delimiter: "<%H>",
  kind: "object",
  fields: {
    hash: { kind: "string", format: "%H" },
    author: {
      kind: "object",
      fields: {
        name: { kind: "string", format: "%an" },
        email: { kind: "string", format: "%ae" },
      },
    },
    committer: {
      kind: "object",
      fields: {
        name: { kind: "string", format: "%cn" },
        email: { kind: "string", format: "%ce" },
      },
    },
    summary: { kind: "string", format: "%s" },
    body: { kind: "string", format: "%b" },
  },
} satisfies FormatDescriptor<GitCommit>;

const TAG_FORMAT: FormatDescriptor<GitTag> = {
  delimiter: "<%(objectname)>",
  kind: "object",
  fields: {
    name: { kind: "string", format: "%(refname:short)" },
    tagger: {
      kind: "object",
      optional: true,
      fields: {
        name: {
          kind: "string",
          format: "%(if)%(object)%(then)%(taggername)%(else)%00%(end)",
        },
        email: {
          kind: "string",
          format: "%(if)%(object)%(then)%(taggeremail:trim)%(else)%00%(end)",
        },
      },
    },
    subject: {
      kind: "string",
      optional: true,
      format: "%(if)%(object)%(then)%(subject)%(else)%00%(end)",
    },
    body: {
      kind: "string",
      optional: true,
      format: "%(if)%(object)%(then)%(body)%(else)%00%(end)",
    },
  },
} satisfies FormatDescriptor<GitTag>;

function formatFields(format: FormatField): string[] {
  if (format.kind === "object") {
    return Object.values(format.fields).map((f) => formatFields(f)).flat();
  }
  return [format.format];
}

function formatArg<T>(format: FormatDescriptor<T>): string {
  // the object hash cannot collide with the object
  const delimiter = format.delimiter;
  const formats = formatFields(format);
  return `${delimiter}!${formats.join(delimiter)}${delimiter}`;
}

function formattedObject(
  format: FormatField,
  parts: string[],
): [string | number | Record<string, unknown> | undefined, number] {
  if (format.kind === "object") {
    const result: Record<string, unknown> = {};
    const length = Object.entries(format.fields).reduce((sum, [key, field]) => {
      const [value, length] = formattedObject(field, parts);
      if (value !== undefined) result[key] = value;
      return sum + length;
    }, 0);
    if (
      format.optional &&
      Object.values(result).every((v) => v === undefined || v === "\x00")
    ) {
      return [undefined, length];
    }
    return [result, length];
  }

  const value = parts.shift();
  assert(value !== undefined, "cannot parse git output");
  if (format.optional && value === "\x00") return [undefined, value.length];
  if (format.kind === "number") return [parseInt(value), value.length];
  return [value, value.length];
}

function parseOutput<T>(format: FormatDescriptor<T>, output: string): T[] {
  const result: T[] = [];
  const fields = formatFields(format);

  while (output.length) {
    const delimiterEnd = output.indexOf("!");
    assertGreater(delimiterEnd, 0, "cannot parse git output");
    const delimiter = output.slice(0, delimiterEnd);
    output = output.slice(delimiter.length + 1);
    const parts = output.split(delimiter, fields.length);

    assertEquals(parts.length, fields.length, "cannot parse git output");
    assertFalse(parts.some((p) => p === undefined), "cannot parse git output");

    const [object, length] = formattedObject(format, parts);
    result.push(object as T);
    output = output.slice(length + (fields.length) * delimiter.length)
      .trimStart();
  }

  return result;
}

/**
 * A commit object that exposes conventional commit details.
 *
 * For example, a commit summary like `feat(cli): add new command` will have
 * its type set to `feat` and modules set to `cli`.
 *
 * A {@linkcode ConventionalCommit} object can be converted to a
 * {@linkcode ConventionalCommit} using the {@linkcode conventional} function.
 *
 * @see {@link https://www.conventionalcommits.org|Conventional Commits}
 */
export interface ConventionalCommit extends GitCommit {
  /** Conventional commits: Commit description. */
  description: string;
  /** Conventional commits: Commit type. */
  type: string | undefined;
  /** Conventional commits: Modules affected by the commit. */
  modules: string[];
  /** Conventional commits: Whether the commit is a breaking change. */
  breaking: boolean;
}

const SUMMARY_PATTERN =
  /^(?:(?<type>[a-z]+)(?:\((?<modules>[^()]*)\))?(?<breaking>!?):s*)?\s*(?<description>.+)$/;

/** Creates a commit object with conventional commit details. */
export function conventional(commit: GitCommit): ConventionalCommit {
  const match = commit.summary?.match(SUMMARY_PATTERN);
  const footerBreaking = commit.body?.match(
    /(^|\n\n)BREAKING CHANGE: (.+)($|\n)/,
  );
  return {
    ...commit,
    description: match?.groups?.description ?? "",
    type: match?.groups?.type,
    modules: match?.groups?.modules?.split(",").map((m) => m.trim()) ?? [],
    breaking: !!footerBreaking || !!match?.groups?.breaking,
  };
}
