import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import {
  bumpVersion,
  findCommitsSinceLastRelease,
  getPackage,
  getWorkspacePackages,
  setPackage,
} from "@tugrulates/internal/package";

function getListCommand() {
  return new Command()
    .description("Lists all packages in the workspace.")
    .example("packages list", "List all Deno packages.")
    .action(async () => {
      const packages = await getWorkspacePackages(".");
      new Table()
        .body(
          packages.map((
            pkg,
          ) => ["📦", pkg.directory, pkg.config.name, pkg.config.version]),
        )
        .render();
    });
}

function getBumpCommand() {
  return new Command()
    .description("Prints a list of active and high quality users on 500px.")
    .example("packages bump", "Updates versions for packages with a change.")
    .example("packages bump --dry-run", "Calculate updates without changes.")
    .option("--dry-run", "Calculate updates without changes.")
    .action(async ({ dryRun }) => {
      const packages = await getWorkspacePackages(".");
      const updates = (await Promise.all(
        packages.filter((pkg) => pkg.config.name && pkg.config.version).map(
          async (pkg) => {
            const commits = await findCommitsSinceLastRelease(pkg);
            const version = bumpVersion(pkg, commits);
            return {
              ...pkg,
              newVersion: version,
              commits,
            };
          },
        ),
      )).filter((pkg) => pkg.config.version !== pkg.newVersion);
      if (!dryRun) {
        await Promise.all(
          updates.map((pkg) =>
            setPackage({
              ...pkg,
              config: { ...pkg.config, version: pkg.newVersion },
            })
          ),
        );
      }
      new Table().body(
        updates.map((
          pkg,
        ) => ["📌", pkg.config.name, pkg.config.version, "👉", pkg.newVersion]),
      ).render();
    });
}

async function getCommand() {
  const command = new Command()
    .name("packages")
    .description("Manage repository packages.")
    .usage("<command> [options]")
    .version((await getPackage()).config.version ?? "")
    .action((): void => command.showHelp())
    .command("list", getListCommand())
    .command("bump", getBumpCommand());
  return command;
}

/** CLI entrypoint. */
async function main(args: string[]) {
  const command = await getCommand();
  await command.parse(args);
}

if (import.meta.main) await main(Deno.args);
