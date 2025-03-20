// deno-lint-ignore-file no-console
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
  type OptionValues,
} from "@commander-js/extra-typings";
import { config } from "@roka/cli/config";
import { pooledMap } from "@std/async";
import { App, version } from "./app.ts";
import type { ApiElement } from "./data.ts";
import { CommandFailed, InvalidConfig } from "./error.ts";
import type { Exercise, ExerciseFilter } from "./exercise.ts";
import { list } from "./list.ts";
import type { Profile } from "./profile.ts";
import { help, messages } from "./strings.ts";
import type { Track } from "./track.ts";
import type { Tracks } from "./tracks.ts";

const CONCURRENCY = 10;
const GLOB_PATTERN = /^[a-z0-9-]*(\*[a-z0-9-]+)*\*?$/;

/** Options for the {@link cli} function. */
export type CliOptions = {
  /** Exercism API token. */
  token?: string;
};

type AppCommand = Command<
  [],
  {
    quiet?: true;
    verbose?: true;
    open?: true;
    sync?: true;
    json?: true;
  }
>;

async function appCommand(
  app: App,
  args: string[],
  options?: CliOptions,
): Promise<AppCommand> {
  const cfg = config<CliOptions>(options ? { path: ":memory:" } : {});
  if (options) await cfg.set(options);
  const { token } = await cfg.get();
  const simpleCommand = new Command("exercism")
    .exitOverride((err: CommanderError) => {
      throw new CommanderError(err.exitCode, err.message, err.code);
    })
    .allowExcessArguments(false)
    .configureOutput({ writeOut: console.info, writeErr: console.error })
    .configureHelp({ showGlobalOptions: true })
    .description(help.app.description)
    .summary(help.app.summary)
    .version(version)
    .option("-q, --quiet", help.opts.quiet)
    .addOption(
      new Option("-v, --verbose", help.opts.verbose).conflicts("quiet"),
    )
    .option("--open", help.opts.open)
    .addOption(new Option("--sync", help.opts.sync).hideHelp())
    .addOption(new Option("--json", help.opts.json).hideHelp());
  simpleCommand.parseOptions(args);
  if (simpleCommand.opts().quiet) console.log = (): void => undefined;
  if (!simpleCommand.opts().verbose) console.debug = (): void => undefined;

  const appCommand = simpleCommand
    .addOption(new Option("--token <token>", help.opts.token).default(token));
  appCommand.parseOptions(args);
  const tokenOption = appCommand.opts().token;
  if (tokenOption) await cfg.set({ token: tokenOption });

  appCommand.addCommand(profileCommand(app.profile, appCommand));
  appCommand.addCommand(tracksCommand(app.tracks, appCommand));

  const tracks = await Array.fromAsync(app.tracks.all());
  const subcommands = await Promise.all(
    tracks.map(async (track) => ({
      command: await trackCommand(track, appCommand),
      hidden: !(await track.isJoined()),
    })),
  );
  for (const subcommand of subcommands) {
    appCommand.addCommand(subcommand.command, { hidden: subcommand.hidden });
  }

  appCommand.action(async () => {
    if (
      await processActionData(
        app,
        { profile: app.profile, tracks: app.tracks },
        appCommand,
      )
    ) return;
    await list([
      app.profile,
      ...(await Array.fromAsync(app.tracks.find({}))),
    ]);
  });

  return appCommand;
}

function profileCommand(profile: Profile, parent: Command): Command {
  return parent
    .createCommand("profile")
    .copyInheritedSettings(parent)
    .description(help.profile.description)
    .summary(help.profile.summary)
    .action(async () => {
      if (await processActionData(profile.app, { profile }, parent)) return;
      await list([profile]);
    });
}

function tracksCommand(tracks: Tracks, parent: Command): Command {
  return parent
    .createCommand("tracks")
    .copyInheritedSettings(parent)
    .description(help.tracks.description)
    .summary(help.tracks.summary)
    .option("-e, --track <slug>", help.opts.track, parseSlug)
    .option("--all", help.opts.all.tracks)
    .addOption(
      new Option("--completed", help.opts.completed.tracks).conflicts("all"),
    )
    .action(async (options) => {
      const found = await Array.fromAsync(tracks.find(options));
      if (
        await processActionData(
          tracks.app,
          { tracks: options.all ? tracks : found },
          parent,
        )
      ) return;
      console.debug(messages.app.found(found.length).tracks);
      await list(found);
    });
}

async function trackCommand(track: Track, parent: Command): Promise<Command> {
  const command = parent
    .createCommand(track.slug)
    .copyInheritedSettings(parent)
    .description((await help.track(track)).description)
    .summary((await help.track(track)).summary)
    .option("-e, --exercise <slug>", help.opts.exercise, parseSlug)
    .addOption(new Option("--all", help.opts.all.exercises).conflicts("locked"))
    .addOption(new Option("--locked", help.opts.locked).conflicts("all"))
    .addOption(
      new Option("--easy", help.opts.easy)
        .conflicts("medium")
        .conflicts("hard"),
    )
    .addOption(
      new Option("--medium", help.opts.medium)
        .conflicts("easy")
        .conflicts("hard"),
    )
    .addOption(
      new Option("--hard", help.opts.hard)
        .conflicts("easy")
        .conflicts("medium"),
    )
    .addOption(
      new Option("--new", help.opts.new)
        .conflicts("started")
        .conflicts("completed"),
    )
    .addOption(
      new Option("--started", help.opts.started)
        .conflicts("new")
        .conflicts("completed"),
    )
    .addOption(
      new Option("--completed", help.opts.completed.exercises)
        .conflicts("new")
        .conflicts("started"),
    )
    .addOption(
      new Option("--published", help.opts.published).conflicts("draft"),
    )
    .addOption(new Option("--draft", help.opts.draft).conflicts("published"))
    .addOption(new Option("--passing", help.opts.passing).conflicts("failing"))
    .addOption(new Option("--failing", help.opts.failing).conflicts("passing"))
    .addOption(new Option("--feedback", help.opts.feedback))
    .addOption(new Option("--outdated", help.opts.outdated))
    .addOption(new Option("--starred", help.opts.starred))
    .addOption(new Option("--commented", help.opts.commented));

  const filters = (): ExerciseFilter => command.opts();

  for (const subcommand of exerciseCommands()) {
    command.addCommand(
      subcommand.command
        .copyInheritedSettings(command)
        .action(async (options) => {
          const exercises = await Array.fromAsync(track.find(filters()));
          console.debug(messages.app.found(exercises.length).exercises);
          let failed = false;
          for await (
            const result of pooledMap(
              subcommand.concurrency ?? CONCURRENCY,
              exercises,
              async (exercise) => {
                try {
                  return await subcommand.action(exercise, options);
                } catch {
                  return false;
                }
              },
            )
          ) {
            if (!result) failed = true;
          }
          if (failed) {
            throw new CommandFailed(subcommand.command.name());
          }
        }),
    );
  }

  command.parseOptions(Deno.args);
  if (Object.keys(command.opts()).length === 0 && await track.isJoined()) {
    const exercises = await Array.fromAsync(track.exercises());
    const subcommands = await Promise.all(
      exercises.map(async (exercise) =>
        await exerciseCommand(exercise, command, parent)
      ),
    );
    for (const subcommand of subcommands) {
      command.addCommand(subcommand, { hidden: true });
    }
  }

  command.action(async () => {
    const exercises = await Array.fromAsync(track.find(filters()));
    if (
      await processActionData(
        track.app,
        Object.keys(filters()).length === 0 ? { track } : { exercises },
        parent,
      )
    ) return;
    await list(exercises);
  });

  return command;
}

async function exerciseCommand(
  exercise: Exercise,
  parent: Command,
  root: AppCommand,
): Promise<Command> {
  const command = parent
    .createCommand(exercise.slug)
    .copyInheritedSettings(parent)
    .description((await help.exercise(exercise)).description)
    .summary((await help.exercise(exercise)).summary);

  for (const subcommand of exerciseCommands()) {
    command.addCommand(
      subcommand.command
        .copyInheritedSettings(command)
        .action(async (options) => {
          if (!(await subcommand.action(exercise, options))) {
            throw new CommandFailed(subcommand.command.name());
          }
        }),
    );
  }

  command.action(async () => {
    const solution = await exercise.solution();
    const files = solution?.files ?? null;
    const iteration = (await solution?.iteration()) ?? null;
    if (
      await processActionData(
        exercise.app,
        { exercise, solution, files, iteration },
        root,
      )
    ) return;
    await list([exercise]);
  });
  return command;
}

interface ExerciseCommand {
  command: Command;
  action: (exercise: Exercise, options: OptionValues) => Promise<boolean>;
  concurrency?: number;
}

function exerciseCommands(): ExerciseCommand[] {
  return [
    {
      command: new Command("start")
        .description(help.exercises.start.description)
        .summary(help.exercises.start.summary),
      action: async (exercise: Exercise) => await exercise.start(),
    },
    {
      command: new Command("code")
        .description(help.exercises.code.description)
        .summary(help.exercises.code.summary),
      action: async (exercise: Exercise) =>
        await (await exercise.setup()).code(),
    },
    {
      command: new Command("format")
        .description(help.exercises.format.description)
        .summary(help.exercises.format.summary)
        .addOption(new Option("--code", help.opts.code.check)),
      action: async (exercise: Exercise, options: { code?: boolean }) =>
        await (await exercise.setup()).format(options),
    },
    {
      command: new Command("lint")
        .description(help.exercises.lint.description)
        .summary(help.exercises.lint.summary)
        .addOption(new Option("--code", help.opts.code.check)),
      action: async (exercise: Exercise, options: { code?: boolean }) =>
        await (await exercise.setup()).lint(options),
    },
    {
      command: new Command("test")
        .description(help.exercises.test.description)
        .summary(help.exercises.test.summary)
        .addOption(new Option("--code", help.opts.code.check)),
      action: async (exercise: Exercise, options: { code?: boolean }) =>
        await (await exercise.setup()).test(options),
    },
    {
      command: new Command("diff")
        .description(help.exercises.diff.description)
        .summary(help.exercises.diff.summary)
        .addOption(new Option("--code", help.opts.code.diff)),
      action: async (exercise: Exercise, options: { code?: boolean }) =>
        await (await exercise.setup()).diff(options),
    },
    {
      command: new Command("download")
        .description(help.exercises.download.description)
        .summary(help.exercises.download.summary)
        .addOption(new Option("--force", help.opts.force.download)),
      action: async (exercise: Exercise, options: { force?: boolean }) => {
        const solution = await exercise.solution();
        if (solution?.files.downloaded()) {
          return await solution.files.download(options);
        } else {
          await exercise.setup();
          return true;
        }
      },
    },
    {
      command: new Command("submit")
        .description(help.exercises.submit.description)
        .summary(help.exercises.submit.summary)
        .addOption(new Option("--force", help.opts.force.submit))
        .addOption(new Option("--complete", help.opts.complete))
        .addOption(new Option("--publish", help.opts.publish)),
      action: async (
        exercise: Exercise,
        options: { force?: boolean; complete?: boolean; publish?: boolean },
      ) => await exercise.submit(options),
      concurrency: 4,
    },
    {
      command: new Command("complete")
        .description(help.exercises.complete.description)
        .summary(help.exercises.complete.summary),
      action: async (exercise: Exercise) => await exercise.complete(),
      concurrency: 1,
    },
    {
      command: new Command("publish")
        .description(help.exercises.publish.description)
        .summary(help.exercises.publish.summary),
      action: async (exercise: Exercise) => await exercise.publish(),
      concurrency: 1,
    },
    {
      command: new Command("update")
        .description(help.exercises.update.description)
        .summary(help.exercises.update.summary),
      action: async (exercise: Exercise) => await exercise.update(),
      concurrency: 1,
    },
  ];
}

export async function processActionData(
  app: App,
  elements: Record<string, null | ApiElement<unknown> | ApiElement<unknown>[]>,
  command: AppCommand,
): Promise<boolean> {
  const options = command.opts();
  if (!options.sync && !options.json && !options.open) {
    return false;
  }

  const flattened = Array.from(Object.values(elements)).flatMap((element) =>
    element ? (element instanceof Array ? element : [element]) : []
  );
  if (options.open) {
    await Promise.all(
      flattened.map(async (e) => app.open(await e.url())),
    );
  }
  if (options.sync) {
    await Promise.all(flattened.map((e) => e.sync()));
  }
  if (options.json) {
    const data = Object.fromEntries(
      await Promise.all(
        Object.entries(elements).map(
          async ([name, element]): Promise<[string, unknown]> => [
            name,
            element instanceof Array
              ? await Promise.all(
                element.map((e) => e.data({ cacheOnly: true })),
              )
              : await element?.data({ cacheOnly: true }),
          ],
        ),
      ),
    );
    console.info(JSON.stringify(data, null, 2));
  }
  return true;
}

export function parseSlug(slug: string, previous?: string[]): string[] {
  if (!GLOB_PATTERN.test(slug)) {
    throw new InvalidArgumentError(messages.app.invalidSlug(slug));
  }
  previous = previous ?? [];
  previous.push(slug);
  return previous;
}

export async function main(
  app: App,
  args: string[],
): Promise<number> {
  try {
    const command = await appCommand(app, args);
    await command.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode ? 1 : 0;
    } else if (error instanceof CommandFailed) {
      return 3;
    } else if (error instanceof InvalidConfig) {
      return 4;
    } else if (error instanceof Error) {
      console.error(messages.app.error(error));
      console.debug(error.stack);
      return 2;
    }
    throw error;
  }
  return 0;
}

if (import.meta.main) {
  const cfg = config<CliOptions>();
  let { token } = await cfg.get();
  if (!token) {
    const input = prompt(
      messages.app.token("https://exercism.org/settings/api_cli").prompt,
    );
    if (!input) {
      console.error(messages.app.token("exercism").missing);
      Deno.exit(1);
    }
    token = input;
  }
  using app = new App({
    endpoint: "https://exercism.org",
    token,
    workspace: Deno.cwd(),
  });
  Deno.exit(await main(app, Deno.args));
}
