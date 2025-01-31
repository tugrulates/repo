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
import { format, increment, parse } from "@std/semver";
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
  version?: string;
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
    let version: string | undefined;
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
  return `${pkg.module}@${version ?? pkg.version}`;
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
): Promise<string | undefined> {
  const [tag] = pkg.config.version
    ? await gitListTags({
      dir: pkg.directory,
      name: versionTag(pkg, "*"),
      sort: "version",
      ...options?.commit ? { to: options.commit } : {},
    })
    : [];
  return tag?.split("@")[1];
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
  oldVersion?: string;
  /** Force an update type, even if changelog is empty. */
  type?: "major" | "minor" | "patch";
}

/** Version bump information. */
export interface VersionUpdate {
  /** Version update tag to create. */
  tag: string;
  /** Version update tag to replace. */
  oldTag: string;
  /** Update type. */
  type: "major" | "minor" | "patch";
  /** Old version. */
  oldVersion: string;
  /** New version. */
  newVersion: string;
}

function updateType(version: string, changelog: Commit[]) {
  if (changelog.length === 0) return undefined;
  const semver = parse(version);
  return (changelog.some((c) => c.breaking) && semver.major > 0)
    ? "major"
    : (changelog.some((c) => c.type === "feat") ||
        changelog.some((c) => c.breaking))
    ? "minor"
    : "patch";
}

/** Calculates new package version using a list of conventional commits since last update. */
export function calculateVersion(
  pkg: Package,
  changelog: Commit[],
  options?: VersionUpdateOptions,
): string {
  const currentVersion = options?.oldVersion ?? pkg.config.version ?? "0.0.0";
  const type = updateType(currentVersion, changelog);
  if (!type) return currentVersion;
  return format(increment(parse(currentVersion), type));
}

interface BumpedPackage extends Package {
  changelog?: Commit[];
  update?: VersionUpdate | undefined;
}

function tagMessage(pkg: BumpedPackage): string {
  if (!pkg.update) return "";
  const title = pkg.update.oldVersion === "0.0.0"
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
  const isInitialRelease = pkg.update.oldVersion === "0.0.0";
  const title = isInitialRelease ? "Initial release" : "Changes";
  const changelog = pkg.changelog?.map((c) => ` * ${c.title}`).join("\n");
  const repo = await getRemoteRepo();
  const fullChangelogUrl = isInitialRelease
    ? `commits/${pkg.update.tag}/${pkg.directory}`
    : `compare/${pkg.update.oldTag}...${pkg.update.tag}`;
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
      pkg.update?.oldVersion ?? pkg.config.version,
      ...pkg.update ? ["👉", pkg.update.newVersion] : [],
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
  const oldVersion = pkg.version ?? "0.0.0";
  if (!type) type = updateType(oldVersion, changelog);
  if (!type) return pkg;
  const newVersion = format(increment(parse(oldVersion), type));
  return {
    ...pkg,
    changelog,
    update: {
      tag: versionTag(pkg, newVersion),
      oldTag: versionTag(pkg, oldVersion),
      type,
      oldVersion,
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
    console.log("🚫 No packages to update.");
    Deno.exit(1);
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
      pkg.config.version = pkg.update.newVersion;
      await writeConfig(pkg);
    }
  }));
  await gitCommit({ message: `${title}\n\n${body}`, add: ["**/deno.json"] });

  const [pr] = await findPullRequests({ token, title, state: "open" });
  if (pr) {
    await gitPushCommits({ force: true }); // can this be done without force?
    await updatePullRequest({ ...pr, title, body }, { token });
    console.log(`🤖 Updated release PR ${pr.number} (${pr.url})`);
  } else {
    await gitPushCommits();
    const pr = await createPullRequest({ token, title, body, draft: true });
    console.log(`🤖 Created release PR ${pr.number} (${pr.url})`);
  }
}

interface ReleaseOptions {
  commit: string;
  token: string;
}

async function createOrUpdateRelease(
  packages: Package[],
  { commit, token }: ReleaseOptions,
) {
  await pool(packages, async (pkg) => {
    if (!pkg.config.version || pkg.config.version === pkg.version) return;

    const tag = versionTag(pkg, pkg.config.version);
    await gitTag(tag, { message: tagMessage(pkg), commit });
    await gitPushTag(tag);

    const data = {
      name: tag,
      body: await releaseBody(pkg),
      draft: true,
      prerelease: !!parse(pkg.config.version).prerelease?.length,
    };

    let [release] = await findReleases({ token, tag, draft: true });
    if (release) {
      release = await updateRelease({ ...release, ...data }, { token });
      console.log(
        `🚀 Updated release ${release.name} (${release.html_url})`,
      );
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
    .option(
      "--bump",
      "Updates packages versions, and creates a release PR.",
      { default: false },
    )
    .option(
      "--release",
      "Creates draft releases for updated packages.",
      { default: false },
    )
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
        { commit, type, bump, release, actor, email, token },
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
        if (release) await createOrUpdateRelease(updates, { commit, token });
      },
    );
  await command.parse(args);
}

if (import.meta.main) await main(Deno.args);
