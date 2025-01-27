import { assert } from "@std/assert";
import { parseArgs } from "@std/cli";
import { distinctBy } from "@std/collections";
import {
  bumpVersion,
  findCommitsSinceLastRelease,
  getWorkspacePackages,
} from "@tugrulates/internal/package";
import { Octokit } from "npm:octokit@^3.1";

async function getPackagesToUpdate(args: (string | number)[]) {
  const directories = args.length ? args.map((dir) => dir.toString()) : ["."];
  const allPackages = await Promise.all(
    directories.map((dir) => getWorkspacePackages(dir)),
  );
  const packages = await Promise.all(
    distinctBy(allPackages.flat(), (p) => p.directory)
      .filter((pkg) => pkg.config.name && pkg.config.version)
      .map(async (pkg) => {
        const commits = await findCommitsSinceLastRelease(pkg);
        const version = bumpVersion(pkg, commits);
        return {
          ...pkg,
          version: version,
          oldVersion: pkg.config.version,
          commits,
        };
      }),
  );
  return packages.filter((pkg) => pkg.version !== pkg.oldVersion);
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, { boolean: ["bump", "dryRun"] });

  const packages = await getPackagesToUpdate(args._);
  if (packages.length === 0) {
    console.log("No packages to update.");
    Deno.exit(1);
  }

  for (const pkg of await getPackagesToUpdate(args._)) {
    assert(pkg.config.name);
    console.log(`${pkg.config.name}: ${pkg.oldVersion} -> ${pkg.version}`);
    for (const commit of pkg.commits) console.log(`  ${commit.title}`);
  }

  const githubToken = Deno.env.get("GITHUB_TOKEN");
  if (!githubToken) throw new Error("GITHUB_TOKEN is not set");
  const githubRepo = Deno.env.get("GITHUB_REPOSITORY");
  if (!githubRepo) throw new Error("GITHUB_REPOSITORY is not set");

  const octokit = new Octokit({ auth: githubToken });
  const _prs = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    {
      owner: "tugrulates",
      repo: "repo",
      head: "release",
    },
  );
  // console.log(prs);
}
