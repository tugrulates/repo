import { distinctBy } from "@std/collections";
import { expandGlob } from "@std/fs";
import { basename, dirname, fromFileUrl, join, normalize } from "@std/path";
import {
  canParse as canParseVersion,
  format as formatVersion,
  increment as incrementVersion,
  parse as parseVersion,
} from "@std/semver";
import {
  conventional,
  type ConventionalCommit,
  git,
  GitError,
  type Tag,
} from "@tugrulates/internal/git";

/** An error while working with packages. */
export class PackageError extends Error {
  /**
   * Construct PackageError.
   *
   * @param message The error message to be associated with this error.
   * @param options.cause The cause of the error.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PackageError";
  }
}

/** Information about a Deno package. */
export interface Package {
  /** Package directory. */
  directory: string;
  /** Package module name. */
  module: string;
  /** Package config from `deno.json`. */
  config: Config;
  /** Calculated package version, might be different than config version. */
  version?: string;
  /** Latest release of this package. */
  release?: Release;
  /** Changes over the last release. */
  update?: Update;
}

/** Configuration for compiling the package. */
export interface CompileConfig {
  /** Entry module for the package. */
  main?: string;
  /** Include patterns for the package. */
  include?: string[];
  /** Enable unstable KV feature. */
  kv?: boolean;
  /** Allowed Deno runtime permissions. */
  permissions?: Permissions;
}

/** Allowed Deno runtime permissions for compiled binary. */
export interface Permissions {
  /** Read file system permissions. */
  read?:
    | boolean
    | NonNullable<Deno.ReadPermissionDescriptor["path"]>
    | NonNullable<Deno.ReadPermissionDescriptor["path"]>[];
  /** Write file system permissions. */
  write?:
    | boolean
    | NonNullable<Deno.WritePermissionDescriptor["path"]>
    | NonNullable<Deno.WritePermissionDescriptor["path"]>[];
  /** Network access permissions. */
  net?:
    | boolean
    | NonNullable<Deno.NetPermissionDescriptor["host"]>
    | NonNullable<Deno.NetPermissionDescriptor["host"]>[];
  /** Environment access permissions. */
  env?:
    | boolean
    | NonNullable<Deno.EnvPermissionDescriptor["variable"]>
    | NonNullable<Deno.EnvPermissionDescriptor["variable"]>[];
  /** Run subprocess permissions. */
  run?:
    | boolean
    | NonNullable<Deno.RunPermissionDescriptor["command"]>
    | NonNullable<Deno.RunPermissionDescriptor["command"]>[];
  /** System access permissions. */
  sys?:
    | boolean
    | NonNullable<Deno.SysPermissionDescriptor["kind"]>
    | NonNullable<Deno.SysPermissionDescriptor["kind"]>[];
  /** Foreign function interface access permissions. */
  ffi?:
    | boolean
    | NonNullable<Deno.FfiPermissionDescriptor["path"]>
    | NonNullable<Deno.FfiPermissionDescriptor["path"]>[];
}

/** Configuration from `deno.json`. */
export interface Config {
  /** Package name. */
  name?: string;
  /** Package version. */
  version?: string | undefined;
  /** Workspace packages. */
  workspace?: string[];
  /** Configuration for compiling the package. */
  compile?: CompileConfig;
}

/** Information about a package release. */
export interface Release {
  /** Release version. */
  version: string;
  /** Release tag. */
  tag: Tag;
}

/** Information about a package update. */
export interface Update {
  /** Type of the update. */
  type: "major" | "minor" | "patch" | undefined;
  /** Updated version, if the package would be released at this state. */
  version: string;
  /** Changes in this update. */
  changelog: ConventionalCommit[];
}

/** Options for package retrieval. */
export interface PackageOptions {
  /**
   * Package directory.
   * @default {dirname(Deno.mainModule())}
   */
  directory?: string;
}

/** Options for workspace retrieval. */
export interface WorkspaceOptions {
  /**
   * List of directories to fetch packages from.
   * @default {["."]}
   */
  directories?: string[];
}

/**
 * Returns the version of the current package.
 *
 * Useful for providing a version number to the user of a tool or application.
 *
 * The version is determined from whichever is available first:
 *  - release tags and conventional commits (local development)
 *  - config version from `deno.json` (deno run)
 *  - config version from `deno.json` in the dist directory (deno compile)
 *  - "(unknown)" if none of the above are available
 */
export async function version(): Promise<string> {
  try {
    const pkg = await getPackage();
    if (pkg.version) return pkg.version;
  } catch (e: unknown) {
    if (!(e instanceof PackageError)) throw e;
  }
  if (import.meta.dirname) {
    for await (
      const path of expandGlob("**/deno.json", {
        root: join(import.meta.dirname, "..", "dist"),
        includeDirs: false,
      })
    ) {
      try {
        const pkg = await getPackage({ directory: dirname(path.path) });
        if (pkg.version) return pkg.version;
      } catch (e: unknown) {
        if (!(e instanceof PackageError)) throw e;
      }
    }
  }
  return "(unknown)";
}

/**
 * Version details of current package, Deno, V8 and TypeScript.
 *
 * @todo Move this to a CLI package.
 */
export async function displayVersion(): Promise<string> {
  return [
    `${await version()} (${Deno.build.target})`,
    `deno ${Deno.version.deno}`,
    `v8 ${Deno.version.v8}`,
    `typescript ${Deno.version.typescript}`,
  ].join("\n");
}

/** Returns information about a package. */
export async function getPackage(options?: PackageOptions): Promise<Package> {
  const directory = normalize(
    options?.directory ?? dirname(fromFileUrl(Deno.mainModule)),
  );
  const config = await getConfig(directory);
  const pkg: Package = {
    directory,
    module: basename(config.name ?? directory),
    config: config,
  };
  if (!config.version) return pkg;
  pkg.version = config.version;
  try {
    // this works if we are in a git repository
    await findRelease(pkg);
    await findUpdate(pkg);
  } catch (e: unknown) {
    if (!(e instanceof GitError)) throw e;
  }
  if (pkg.update) {
    pkg.version = formatVersion({
      ...parseVersion(pkg.update.version),
      ...pkg.update.changelog[0] && {
        prerelease: [`pre.${pkg.update.changelog.length}`],
        build: [pkg.update.changelog[0].short],
      },
    });
  } else if (pkg.release) {
    pkg.version = pkg.release.version;
  } else {
    pkg.version = config.version;
  }
  return pkg;
}

/** Returns all packages, recursively traversing workspaces. */
export async function getWorkspace(
  options?: WorkspaceOptions,
): Promise<Package[]> {
  const directories = options?.directories ?? ["."];
  const packages = await Promise.all(
    directories?.map((directory) => getPackage({ directory, ...options })),
  );
  const all = (await Promise.all(
    packages.map(async (pkg) => [
      pkg,
      ...await getWorkspace({
        ...options,
        directories: pkg.config.workspace?.map((child) =>
          join(pkg.directory, child)
        ) ??
          [],
      }),
    ]),
  )).flat();
  return distinctBy(all, (pkg) => pkg.directory);
}

async function getConfig(directory: string): Promise<Config> {
  const configFile = join(directory, "deno.json");
  try {
    const data = await Deno.readTextFile(configFile);
    return (JSON.parse(data)) as Config;
  } catch (e: unknown) {
    throw new PackageError(`Cannot read package config: ${configFile}`, {
      cause: e,
    });
  }
}

async function findRelease(pkg: Package) {
  const repo = git({ cwd: pkg.directory });
  const name = `${pkg.module}@*`;
  const sort = "version";
  const [tag] = [
    ...await repo.tagList({ name, sort, pointsAt: "HEAD" }),
    ...await repo.tagList({ name, sort, noContains: "HEAD" }),
  ];
  if (tag === undefined) return;
  const version = tag.name?.split("@")[1];
  if (!version || !canParseVersion(version)) {
    throw new PackageError(
      `Cannot parse semantic version from tag: ${tag.name}`,
    );
  }
  pkg.release = { version, tag };
}

async function findUpdate(pkg: Package) {
  const log = await git({ cwd: pkg.directory }).log({
    ...pkg.release?.tag !== undefined
      ? { range: { from: pkg.release.tag } }
      : { paths: ["."] },
  });
  const changelog = log.map((c) => conventional(c)).filter((c) =>
    c.modules.includes(pkg.module) || c.modules.includes("*")
  );
  if (!changelog.length) return;
  const type = (changelog.some((c) => c.breaking) &&
      parseVersion(pkg?.version ?? "0.0.0").major > 0)
    ? "major"
    : (changelog.some((c) => c.type === "feat") ||
        changelog.some((c) => c.breaking))
    ? "minor"
    : "patch";
  const version = formatVersion(
    incrementVersion(parseVersion(pkg.release?.version ?? "0.0.0"), type),
  );
  pkg.update = { type, version, changelog };
}
