import { dirname, fromFileUrl, join, normalize } from "@std/path";
import { format, increment, parse } from "@std/semver";
import { type Commit, gitListTags, gitLog } from "./git.ts";

/** Information about a Deno package. */
export interface Package {
  /** Package directory. */
  directory: string;
  /** Package config from deno.json. */
  config: PackageConfig;
}

/** Configuration from `deno.json`. */
export interface PackageConfig {
  /** Package name. */
  name?: string;
  /** Package version. */
  version?: string;
  /** Workspace packages. */
  workspace?: string[];
}

/**
 * Return information about a package using its `deno.json`.
 *
 * If `directory` is not provided, the current running package is used.
 *
 * @param directory Optional package directory with a `deno.json`.
 */
export async function getPackage(directory?: string): Promise<Package> {
  if (!directory) directory = dirname(fromFileUrl(Deno.mainModule));
  directory = normalize(directory);
  try {
    const data = await Deno.readTextFile(join(directory, "deno.json"));
    const config = (JSON.parse(data)) as PackageConfig;
    return { directory, config };
  } catch (e: unknown) {
    throw new Error(`Cannot read package: ${directory}`, { cause: e });
  }
}

/**
 * Create a package or update package config through `deno.json`.
 *
 * @param pkg Package information to write.
 */
export async function setPackage(pkg: Package): Promise<void> {
  await Deno.mkdir(pkg.directory, { recursive: true });
  await Deno.writeTextFile(
    join(pkg.directory, "deno.json"),
    JSON.stringify(pkg.config, undefined, 2) + "\n",
  );
}

/** Return information about all workspace packages under `directory` */
export async function getWorkspacePackages(
  directory: string,
): Promise<Package[]> {
  const pkg = await getPackage(directory);
  const workspace = await Promise.all(
    (pkg.config.workspace ?? [])?.map((p) =>
      getWorkspacePackages(join(directory, p))
    ),
  );
  return [pkg, ...workspace.flat()];
}

/** Find all commits affecting a package since its last release. */
export async function findCommitsSinceLastRelease(
  pkg: Package,
): Promise<Commit[]> {
  const module = pkg.config.name?.replace(/^@[^/]+\//, "");
  if (!module) {
    throw new Error(
      `Cannot find commits for unnamed package: ${pkg.directory}`,
    );
  }
  const [tag] = pkg.config.version
    ? await gitListTags({
      repo: pkg.directory,
      name: `${module}@${pkg.config.version}`,
    })
    : [];
  const log = await gitLog({
    repo: pkg.directory,
    ...tag ? { from: tag } : {},
  });
  return log.filter((c) =>
    c.modules.includes(module) || c.modules.includes("*")
  );
}

/** Increment package version using a list of conventional commits. */
export function bumpVersion(pkg: Package, commits: Commit[]): string {
  if (!pkg.config.version) return "0.1.0";
  const semver = parse(pkg.config.version ?? "");
  const releaseType = (commits.some((c) => c.breaking) && semver.major > 0)
    ? "major"
    : (commits.some((c) => c.type === "feat") ||
        commits.some((c) => c.breaking))
    ? "minor"
    : (commits.some((c) => c.type === "fix"))
    ? "patch"
    : undefined;
  if (!releaseType) return pkg.config.version;
  return format(increment(semver, releaseType));
}
