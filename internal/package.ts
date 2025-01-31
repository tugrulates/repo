import { Command, EnumType } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { distinctBy } from "@std/collections";
import {
  basename,
  dirname,
  fromFileUrl,
  join,
  normalize,
  resolve,
} from "@std/path";
import {
  canParse,
  format,
  increment,
  lessThan,
  parse,
  type SemVer,
} from "@std/semver";
import { toPascalCase } from "@std/text";
import { pool } from "./async.ts";
import {
  type Commit,
  gitCheckout,
  gitCommit,
  gitListTags,
  gitLog,
  gitPushCommits,
  gitPushTag,
  gitTag,
  gitUser,
} from "./git.ts";
import {
  createPullRequest,
  createRelease,
  findPullRequests,
  findReleases,
  getRemoteRepo,
  updatePullRequest,
  updateRelease,
} from "./github.ts";

/** Information about a Deno package. */
export interface Package {
  /** Package directory. */
  directory: string;
  /** Package module name. */
  module: string;
  /** Last release version, may be different than config version */
  version?: SemVer;
  /** Package config from `deno.json`. */
  config: PackageConfig;
}

/** Configuration from `deno.json`. */
export interface PackageConfig {
  /** Package name. */
  name?: string;
  /** Package version. */
  version?: string | undefined;
  /** Workspace packages. */
  workspace?: string[];
}

/** Options for package retrieval. */
export interface PackageOptions {
  /** Package directory, default is the current running package. */
  directory?: string;
  /** Commit to get version information from. */
  commit?: string;
}

/** Returns information about a package using its `deno.json`. */
export async function getPackage(options?: PackageOptions): Promise<Package> {
  const directory = normalize(
    options?.directory ?? dirname(fromFileUrl(Deno.mainModule)),
  );
  try {
    const data = await Deno.readTextFile(join(directory, "deno.json"));
    const config = (JSON.parse(data)) as PackageConfig;
    const pkg = {
      directory,
      module: basename(config.name ?? resolve(directory)),
      config,
    };
    let version: SemVer | undefined;
    try {
      version = await getLastVersion(pkg, options);
    } catch {
      /** @todo: fix tests */
    }
    return {
      ...pkg,
      ...version ? { version } : {},
    };
  } catch (e: unknown) {
    throw new Error(`Cannot read package: ${directory}`, { cause: e });
  }
}

/**
 * Creates a package or update package config through `deno.json`.
 *
 * @param pkg Package information to write.
 */
export async function writeConfig(pkg: Package): Promise<void> {
  await Deno.mkdir(pkg.directory, { recursive: true });
  await Deno.writeTextFile(
    join(pkg.directory, "deno.json"),
    JSON.stringify(pkg.config, undefined, 2) + "\n",
  );
}

function versionTag(pkg: Package, version?: string): string {
  if (!version && pkg.version) version = format(pkg.version);
  if (!version) throw new Error(`Cannot determine version for ${pkg.module}`);
  return `${pkg.module}@${version}`;
}

/** Options for package retrieval. */
export interface WorkspaceOptions {
  /** Directories to retrieve packages from, default is the current working directory. */
  directories?: string[];
}

/** Returns all packages, recursively traversing workspaces. */
export async function getWorkspace(
  options?: WorkspaceOptions,
): Promise<Package[]> {
  const directories = options?.directories ?? ["."];
  const packages = await Promise.all(
    directories?.map((directory) => getPackage({ directory })),
  );
  const all = (await Promise.all(
    packages.map(async (pkg) => [
      pkg,
      ...await getWorkspace({
        directories: pkg.config.workspace?.map((child) =>
          join(pkg.directory, child)
        ) ??
          [],
      }),
    ]),
  )).flat();
  return distinctBy(all, (pkg) => pkg.directory);
}

/** Options for determining version. */
export interface VersionOptions {
  /** Commit to compare against. */
  commit?: string;
}

/** Finds the last release version for a package. */
async function getLastVersion(
  pkg: Package,
  options?: VersionOptions,
): Promise<SemVer | undefined> {
  const [tag] = pkg.config.version
    ? await gitListTags({
      dir: pkg.directory,
      name: versionTag(pkg, "*"),
      sort: "version",
      ...options?.commit ? { to: options.commit } : {},
    })
    : [];
  const version = tag?.split("@")[1];
  if (!version || !canParse(version)) {
    throw new Error(`Cannot parse semantic version from tag: ${tag}`);
  }
  return parse(version);
}

/** Finds all commits affecting a package since its last release. */
export async function getChangelog(
  pkg: Package,
  options?: VersionOptions,
): Promise<Commit[]> {
  const tag = pkg.version && versionTag(pkg);
  const log = await gitLog({
    dir: pkg.directory,
    ...tag ? { from: tag } : { path: "." },
    ...options?.commit ? { to: options.commit } : {},
  });
  return log.filter((c) =>
    c.modules.includes(pkg.module) || c.modules.includes("*")
  );
}

/** Options for calculating version updates. */
export interface VersionUpdateOptions extends VersionOptions {
  /** Use a specific starting version. */
  oldVersion?: SemVer;
  /** Force an update type, even if changelog is empty. */
  type?: "major" | "minor" | "patch";
}

/** Version bump information. */
export interface VersionUpdate {
  /** Version update tag to create. */
  tag: string;
  /** Version update tag to replace. */
  oldTag?: string;
  /** Update type. */
  type: "major" | "minor" | "patch";
  /** Old version. */
  oldVersion?: SemVer;
  /** New version. */
  newVersion: SemVer;
}

export function updateType(version: SemVer, changelog: Commit[]) {
  if (changelog.length === 0) return undefined;
  return (changelog.some((c) => c.breaking) && version.major > 0)
    ? "major"
    : (changelog.some((c) => c.type === "feat") ||
        changelog.some((c) => c.breaking))
    ? "minor"
    : "patch";
}

interface BumpedPackage extends Package {
  changelog?: Commit[];
  update?: VersionUpdate | undefined;
}

function tagMessage(pkg: BumpedPackage): string {
  if (!pkg.update) return "";
  const title = pkg.update.oldVersion
    ? "Initial release"
    : `${toPascalCase(pkg.update.type)} release`;
  const changelog = pkg.changelog?.map((c) => ` * ${c.title}`).join(
    "\n",
  );
  if (!changelog?.length) return title;
  return `${title}\n\n${changelog}`;
}

async function releaseBody(pkg: BumpedPackage): Promise<string> {
  if (!pkg.update) return "";
  const title = pkg.update.oldVersion ? "Changes" : "Initial release";
  const changelog = pkg.changelog?.map((c) => ` * ${c.title}`).join("\n");
  const repo = await getRemoteRepo();
  const fullChangelogUrl = pkg.update.oldTag
    ? `compare/${pkg.update.oldTag}...${pkg.update.tag}`
    : `commits/${pkg.update.tag}/${pkg.directory}`;
  return [
    `## ${title}`,
    "",
    changelog,
    "",
    "## Details",
    "",
    ` * [Full changelog](https://github.com/${repo.owner}/${repo.repo}/${fullChangelogUrl})`,
    ` * [Documentation](https://jsr.io/${pkg.config.name}@${pkg.update.newVersion})`,
  ]
    .join("\n");
}

function outputPackages(packages: BumpedPackage[]) {
  new Table().body(
    packages.map((pkg) => [
      "📦",
      pkg.directory,
      pkg.config.name,
      pkg.update?.oldVersion
        ? format(pkg.update?.oldVersion)
        : pkg.config.version,
      ...pkg.update ? ["👉", format(pkg.update.newVersion)] : [],
    ]),
  ).render();

  if (packages.some((pkg) => pkg.changelog?.length)) console.log();

  for (const pkg of packages) {
    if (pkg.update) {
      console.log(`📝   ${pkg.config.name} [${pkg.update.type}]`);
      for (const commit of pkg.changelog ?? []) {
        console.log(`     ${commit.title}`);
      }
      console.log();
    }
  }
}

interface UpdateOptions {
  commit: string;
  type: "major" | "minor" | "patch" | undefined;
}

async function updatePackage(
  pkg: Package,
  { commit, type }: UpdateOptions,
): Promise<BumpedPackage> {
  if (!pkg.config.name || !pkg.config.version) return pkg;
  const changelog = await getChangelog(pkg, { commit });
  const oldVersion = pkg.version;
  type ??= updateType(oldVersion ?? parse("0.0.0"), changelog);
  if (!type) return pkg;
  const newVersion = increment(oldVersion ?? parse("0.0.0"), type);
  return {
    ...pkg,
    changelog,
    update: {
      ...oldVersion
        ? { oldVersion, oldTag: versionTag(pkg, format(oldVersion)) }
        : {},
      tag: versionTag(pkg, format(newVersion)),
      type,
      newVersion,
    },
  };
}

interface PullRequestOptions {
  token: string;
}

async function createOrUpdatePullRequest(
  packages: BumpedPackage[],
  { token }: PullRequestOptions,
) {
  if (!packages.some((pkg) => pkg.update)) {
    console.log("🚫 No packages to bump.");
    return;
  }

  const title = "chore: release";
  const body = (await Promise.all(packages.map(async (pkg) => {
    if (!pkg.update) return "";
    return [`# ${pkg.update.tag}`, "", await releaseBody(pkg) ?? ""];
  }))).flat().join("\n\n");

  /** @todo change release branch name */
  await gitCheckout({ newBranch: "test" });
  await Promise.all(packages.map(async (pkg) => {
    if (pkg.update) {
      pkg.config.version = format(pkg.update.newVersion);
      await writeConfig(pkg);
    }
  }));
  await gitCommit({ message: `${title}\n\n${body}`, add: ["**/deno.json"] });

  const [pr] = await findPullRequests({ token, title, state: "open" });
  if (pr) {
    await gitPushCommits({ force: true }); // can this be done without force?
    await updatePullRequest({ ...pr, title, body }, { token });
    console.log(`🤖 Updated release PR ${pr.number} (${pr.html_url})`);
  } else {
    await gitPushCommits();
    const pr = await createPullRequest({ token, title, body, draft: true });
    console.log(`🤖 Created release PR ${pr.number} (${pr.html_url})`);
  }
}

interface ReleaseOptions {
  commit: string;
  sign: boolean;
  token: string;
}

async function createOrUpdateRelease(
  packages: Package[],
  { commit, sign, token }: ReleaseOptions,
) {
  const releases = packages.filter((pkg) =>
    pkg.config.version && canParse(pkg.config.version) &&
    (!pkg.version || lessThan(pkg.version, parse(pkg.config.version)))
  );
  if (!releases.length) {
    console.log("🚫 No packages to release.");
    return;
  }

  await pool(releases, async (pkg) => {
    const version = parse(pkg.config.version ?? "0.0.0");
    const tag = versionTag(pkg, format(version));
    await gitTag(tag, { sign, message: tagMessage(pkg), commit });
    await gitPushTag(tag);

    const data = {
      name: tag,
      body: await releaseBody(pkg),
      draft: true,
      prerelease: !!version.prerelease?.length,
    };

    let [release] = await findReleases({ token, tag, draft: true });
    if (release) {
      release = await updateRelease({ ...release, ...data }, { token });
      console.log(`🚀 Updated release ${release.name} (${release.html_url})`);
    } else {
      release = await createRelease(tag, { token, ...data });
      console.log(`🚀 Created release ${release.name} (${release.html_url})`);
    }
  });
}

async function main(args: string[]) {
  const command = new Command()
    .name("packages")
    .description("Manage workspace packages.")
    .version((await getPackage()).config.version ?? "")
    .arguments("[directories...:file]")
    .option(
      "--commit=<string>",
      "Calculate changes over given commit or symbolic ref.",
      { default: "HEAD" },
    )
    .option("--bump", "Updates packages versions, and creates a release PR.", {
      default: false,
    })
    .option("--release", "Creates draft releases for updated packages.", {
      default: false,
    })
    .option("--sign", "Signs created tags.", { default: false })
    .type("update", new EnumType(["major", "minor", "patch"]))
    .option(
      "--type=<type:update>",
      "Force release type for all affected packages.",
    )
    .env(
      "GITHUB_ACTOR=<actor:string>",
      "GitHub user that triggered the bump or release.",
      { prefix: "GITHUB_" },
    )
    .env(
      "GITHUB_EMAIL=<email:string>",
      "E-mail of GitHub user that triggered the bump or release.",
      { prefix: "GITHUB_" },
    )
    .env(
      "GITHUB_TOKEN=<token:string>",
      "GitHub personal token for GitHub actions.",
      { required: true, prefix: "GITHUB_" },
    )
    .action(
      async (
        { commit, type, bump, release, sign, actor, email, token },
        ...directories
      ) => {
        if (directories.length === 0) directories = ["."];
        const packages = await getWorkspace({ directories });
        const updates = await Promise.all(
          packages.map((pkg) => updatePackage(pkg, { commit, type })),
        );

        outputPackages(updates);

        await gitUser({
          ...actor ? { name: actor } : {},
          ...email ? { email } : {},
        });

        if (bump) await createOrUpdatePullRequest(updates, { token });
        if (release) {
          await createOrUpdateRelease(updates, { commit, sign, token });
        }
      },
    );
  await command.parse(args);
}

if (import.meta.main) await main(Deno.args);
