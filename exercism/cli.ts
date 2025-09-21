// deno-lint-ignore-file no-console
import { Command, ValidationError } from "@cliffy/command";
import { Secret } from "@cliffy/prompt";
import { Cell, Row, Table } from "@cliffy/table";
import { pool } from "@roka/async/pool";
import { type Config, config } from "@roka/cli/config";
import { version } from "@roka/forge/version";
import type { JsonRequestOptions } from "@roka/http/json/client";
import { clearCache } from "@roka/http/request";
import { omit } from "@std/collections";
import open from "open";
import {
  type Element,
  type Exercise,
  type ExerciseFilters,
  type Exercism,
  exercism,
  type ExercismOptions,
  type Profile,
  type Track,
  type TrackFilters,
} from "./exercism.ts";
import { display, help, messages } from "./strings.ts";

/**
 * Run the `exercism` tool with the given command-line arguments.
 *
 * @param args Command-line arguments.
 * @param options Use given config instead of the default user config.
 * @returns The exit code of the command.
 */
export async function cli(
  args: string[],
  options?: ExercismOptions,
): Promise<number> {
  const cfg = config<{ token: string }>(
    options?.request?.token ? { path: ":memory:" } : {},
  );
  async function data(
    options: JsonRequestOptions & TrackFilters & ExerciseFilters & {
      all?: boolean | undefined;
    },
  ): Promise<
    { profile: Profile; tracks: Track[]; exercises: Exercise[] }
  > {
    const filters = { ...options };
    if (!filters.all && !filters.track) filters.joined = true;
    if (!filters.all && !filters.exercise) filters.unlocked = true;
    const exercism = await manager(cfg, { request: options });
    const [profile, tracks] = await Promise.all([
      exercism.profile(),
      exercism.tracks(filters),
    ]);
    const exercises =
      (await pool(tracks, (t) => t.exercises(filters), { concurrency: 1 }))
        .flat();
    return { profile, tracks, exercises };
  }
  const command = new Command()
    .name("exercism")
    .description(help.app.description)
    .usage("<command> [options]")
    .version(await version({ release: true, target: true }))
    .option("--sync", help.options.sync, { default: false })
    .option("--json", help.options.json, { default: false })
    .option("--open", help.options.open, { default: false })
    .env("EXERCISM_TOKEN=<token:string>", help.options.token, {
      global: true,
      prefix: "EXERCISM_",
    })
    .option("--token <token:string>", help.options.token, { global: true })
    .group("Filters")
    .option("--all", help.options.easy, { global: true })
    .option("-t, --track <slug>", help.options.track, {
      global: true,
      collect: true,
    })
    .option("-e, --exercise <slug>", help.options.exercise, {
      global: true,
      collect: true,
    });
  command
    .option("--easy", help.options.easy, {
      global: true,
      conflicts: ["medium"],
    })
    .option("--medium", help.options.medium, {
      global: true,
      conflicts: ["hard"],
    })
    .option("--hard", help.options.hard, {
      global: true,
      conflicts: ["easy"],
    });
  command
    .option("--started", help.options.started, { global: true })
    .option("--no-started", help.options.started, { global: true });
  command
    .option("--iterated", help.options.started, { global: true })
    .option("--no-iterated", help.options.started, { global: true });
  command
    .option("--completed", help.options.completed, { global: true })
    .option("--no-completed", help.options.completed, { global: true });
  command
    .option("--published", help.options.published, { global: true })
    .option("--no-published", help.options.published, { global: true });
  command
    .option("--outdated", help.options.outdated, { global: true })
    .option("--no-outdated", help.options.outdated, { global: true });
  command
    .option("--passing", help.options.passing, { global: true })
    .option("--no-passing", help.options.passing, { global: true });
  command
    .option("--failing", help.options.failing, { global: true })
    .option("--no-failing", help.options.failing, { global: true });
  command
    .option("--feedback", help.options.feedback, { global: true })
    .option("--starred", help.options.starred, { global: true })
    .option("--commented", help.options.commented, { global: true });
  command.action(async (options) => {
    const { profile, tracks, exercises } = await data(options);
    if (
      Object.keys(omit(options, ["sync", "json", "open", "token", "all"]))
        .length === 0
    ) {
      if (await preprocess({ profile, tracks }, options)) return;
      list([profile]);
      console.log();
      list(tracks);
    } else {
      if (
        await preprocess({
          profile,
          tracks,
          exercises: Object.values(exercises).flat(),
        }, options)
      ) return;
      list([profile]);
      console.log();
      const exercisesByTrack = Object.groupBy(exercises, (e) => e.track.slug);
      for (const [_, trackExercises] of Object.entries(exercisesByTrack)) {
        const [first] = trackExercises ?? [];
        if (!first) continue;
        list([first.track]);
        console.log();
        list(trackExercises ?? []);
        console.log();
      }
    }
  });
  command.command("test")
    .action((options) => {
      console.log(options);
      // const { exercises } = await data(cfg, options);
      // list(exercises);
    });
  command.command("clear")
    .action(async () => {
      await Promise.all([
        clearCache(),
        clearCache("exercism"),
        cfg.clear(),
      ]);
    });
  try {
    await command.parse(args);
  } catch (e: unknown) {
    if (e instanceof ValidationError) {
      command.showHelp();
      console.error(`❌ ${e.message}`);
      return 1;
    }
    const errors = (e instanceof AggregateError) ? e.errors : [e];
    console.error(e);
    for (const error of errors) {
      console.error(`❌ ${error.message}`);
      if (error["cause"] && error["cause"]["error"]) {
        console.error(error.cause.error);
      }
    }
    return 2;
  }
  return 0;
}

interface DataOptions {
  sync?: boolean;
  json?: boolean;
  open?: boolean;
}

async function manager(
  cfg: Config<{ token: string }>,
  options: ExercismOptions | undefined,
): Promise<Exercism> {
  const cacheOnly = options?.request?.cache === "only-if-cached";
  const msg = messages.app.token("https://exercism.org/settings/api_cli");
  let token = options?.request?.token ?? (await cfg.get()).token;
  if (!cacheOnly) {
    if (!token) token = await Secret.prompt(msg.prompt);
    if (!token && cacheOnly) throw new Error(msg.missing);
    else await cfg.set({ token });
  }
  const client = exercism({
    ...options,
    request: {
      // TODO: Optimize the general request regime.
      // Currently, the server limits to 60 requests per minute.
      cacheMaxAge: 60 * 60 * 24 * 7, // 1 week
      retry: {
        minTimeout: 4000,
        maxAttempts: 15,
      },
      ...token && { token },
      ...options?.request,
    },
  });
  if (!cacheOnly && !await client.authenticated()) {
    await cfg.clear();
    throw new Error(msg.invalid);
  }
  return client;
}

async function preprocess(
  elements: Record<string, Element | Element[]>,
  options: DataOptions,
): Promise<boolean> {
  if (!options.sync && !options.json && !options.open) return false;
  const flattened = Array.from(Object.values(elements)).flatMap((element) =>
    element ? (element instanceof Array ? element : [element]) : []
  );
  if (options.open) {
    await pool(flattened, (e) => open(e.url), { concurrency: 1 });
  }
  if (options.sync) await pool(flattened, (e) => e.sync(), { concurrency: 1 });
  if (options.json) console.info(JSON.stringify(elements, undefined, 2));
  return true;
}

function list(items: (Profile | Track | Exercise)[]): void {
  function profile(profile: Profile): Row {
    const messages = display.profile(profile);
    return Row.from([messages.handle, right(messages.reputation)]);
  }
  function track(track: Track): Row {
    const messages = display.track(track);
    const alert = (track.hasNotifications) ? display.notification : "";
    if (track.completed) {
      return Row.from([
        messages.completed,
        alert,
        right(messages.numExercises),
      ]);
    } else if (track.joined) {
      return Row.from([messages.joined, alert, right(messages.numCompleted)]);
    } else {
      return Row.from([
        messages.notJoined,
        alert,
        right(messages.numExercises),
      ]);
    }
  }
  function exercise(exercise: Exercise): Row {
    const solution = exercise.solution;
    const messages = display.exercise(exercise);
    const cells = [
      messages.feedback,
      messages.tests,
      messages.social,
    ];
    if (!(exercise.track.joined)) {
      return Row.from([messages.notJoined, ...cells]);
    } else if (!exercise.unlocked) {
      return Row.from([messages.locked, ...cells]);
    } else if (!exercise.solution) {
      return Row.from([messages.new, ...cells]);
    } else if (solution && exercise.solution?.outdated) {
      return Row.from([messages.outdated, ...cells]);
    } else if (solution && !exercise.solution?.completed) {
      return Row.from([messages.started, ...cells]);
    } else if (solution && !exercise.solution?.published) {
      return Row.from([messages.draft, ...cells]);
    } else if (exercise.solution?.failing) {
      return Row.from([messages.failing, ...cells]);
    } else if (exercise.solution?.hasAutomatedFeedback) {
      return Row.from([messages.hasFeedback, ...cells]);
    } else if (!exercise.solution?.passing) {
      return Row.from([messages.noTestResults, ...cells]);
    } else {
      return Row.from([messages.completed, ...cells]);
    }
  }
  function right(text: string): Cell {
    return new Cell(text).align("right");
  }
  const rows = items.map((item) =>
    "reputation" in item
      ? profile(item)
      : "joined" in item
      ? [" ", ...track(item)]
      : ["   ", ...exercise(item)]
  );
  Table.from(rows).render();
}

// const CONCURRENCY = 10;
// const GLOB_PATTERN = /^[a-z0-9-]*(\*[a-z0-9-]+)*\*?$/;

// async function appCommand(
//   exercism: Exercism,
//   args: string[],
// ): Promise<AppCommand> {
//   const command = new Command("exercism")
//     .exitOverride((err: CommanderError) => {
//       throw new CommanderError(err.exitCode, err.message, err.code);
//     })
//     .allowExcessArguments(false)
//     .configureOutput({ writeOut: console.info, writeErr: console.error })
//     .configureHelp({ showGlobalOptions: true })
//     .description(help.app.description)
//     .summary(help.app.summary)
//     // .version(await version({ release: true, target: true }))
//     .option("-q, --quiet", help.opts.quiet)
//     .addOption(
//       new Option("-v, --verbose", help.opts.verbose).conflicts("quiet"),
//     )
//     .option("--open", help.opts.open)
//     .addOption(new Option("--sync", help.opts.sync).hideHelp())
//     .addOption(new Option("--json", help.opts.json).hideHelp());
//   command.parseOptions(args);
//   if (command.opts().quiet) console.log = (): void => undefined;
//   if (!command.opts().verbose) console.debug = (): void => undefined;

//   // const appCommand = command
//   //   .addOption(new Option("--token <token>", help.opts.token).default(token));
//   // command.parseOptions(args);
//   // const tokenOption = appCommand.opts().token;
//   // if (tokenOption) await cfg.set({ token: tokenOption });

//   command.addCommand(profileCommand(exercism, command));
//   command.addCommand(tracksCommand(exercism, command));

//   const tracks = await exercism.tracks({ all: true });
//   const subcommands = await Promise.all(
//     tracks.map(async (track) => ({
//       command: await trackCommand(exercism, track, command),
//       hidden: !(track.joined),
//     })),
//   );
//   for (const subcommand of subcommands) {
//     command.addCommand(subcommand.command, { hidden: subcommand.hidden });
//   }

//   command.action(async () => {
//     const [profile, tracks] = await Promise.all([
//       exercism.profile(),
//       exercism.tracks(),
//     ]);
//     if (await processActionData(exercism, { profile, tracks }, command)) return;
//     list([profile, ...tracks]);
//   });

//   return command;
// }

// function profileCommand(
//   exercism: Exercism,
//   parent: Command,
// ): Command {
//   return parent
//     .createCommand("profile")
//     .copyInheritedSettings(parent)
//     .description(help.profile.description)
//     .summary(help.profile.summary)
//     .action(async () => {
//       const profile = await exercism.profile();
//       if (await processActionData(exercism, { profile }, parent)) return;
//       list([profile]);
//     });
// }

// function tracksCommand(
//   exercism: Exercism,
//   parent: Command,
// ): Command {
//   return parent
//     .createCommand("tracks")
//     .copyInheritedSettings(parent)
//     .description(help.tracks.description)
//     .summary(help.tracks.summary)
//     .option("-t, --track <slug>", help.opts.track, parseSlug)
//     .option("--all", help.opts.all.tracks)
//     .addOption(
//       new Option("--completed", help.opts.completed.tracks).conflicts("all"),
//     )
//     .action(async (options) => {
//       const tracks = await exercism.tracks(options);
//       if (await processActionData(exercism, { tracks }, parent)) return;
//       console.debug(messages.app.found(tracks.length).tracks);
//       list(tracks);
//     });
// }

// async function trackCommand(
//   exercism: Exercism,
//   track: Track,
//   parent: Command,
// ): Promise<Command> {
//   const command = parent
//     .createCommand(track.slug)
//     .copyInheritedSettings(parent)
//     .description((help.track(track)).description)
//     .summary((help.track(track)).summary)
//     .option("-e, --exercise <slug>", help.opts.exercise, parseSlug)
//     .addOption(new Option("--all", help.opts.all.exercises).conflicts("locked"))
//     .addOption(new Option("--locked", help.opts.locked).conflicts("all"))
//     .addOption(
//       new Option("--easy", help.opts.easy)
//         .conflicts("medium")
//         .conflicts("hard"),
//     )
//     .addOption(
//       new Option("--medium", help.opts.medium)
//         .conflicts("easy")
//         .conflicts("hard"),
//     )
//     .addOption(
//       new Option("--hard", help.opts.hard)
//         .conflicts("easy")
//         .conflicts("medium"),
//     )
//     .addOption(
//       new Option("--new", help.opts.new)
//         .conflicts("started")
//         .conflicts("completed"),
//     )
//     .addOption(
//       new Option("--started", help.opts.started)
//         .conflicts("new")
//         .conflicts("completed"),
//     )
//     .addOption(
//       new Option("--completed", help.opts.completed.exercises)
//         .conflicts("new")
//         .conflicts("started"),
//     )
//     .addOption(
//       new Option("--published", help.opts.published).conflicts("draft"),
//     )
//     .addOption(new Option("--draft", help.opts.draft).conflicts("published"))
//     .addOption(new Option("--passing", help.opts.passing).conflicts("failing"))
//     .addOption(new Option("--failing", help.opts.failing).conflicts("passing"))
//     .addOption(new Option("--feedback", help.opts.feedback))
//     .addOption(new Option("--outdated", help.opts.outdated))
//     .addOption(new Option("--starred", help.opts.starred))
//     .addOption(new Option("--commented", help.opts.commented));

//   const filters = (): ExerciseOptions => command.opts();

//   for (const subcommand of exerciseCommands()) {
//     command.addCommand(
//       subcommand.command
//         .copyInheritedSettings(command)
//         .action(async (options) => {
//           const exercises = await track.exercises(filters());
//           console.debug(messages.app.found(exercises.length).exercises);
//           let failed = false;
//           for await (
//             const result of pooledMap(
//               subcommand.concurrency ?? CONCURRENCY,
//               exercises,
//               async (exercise) => {
//                 try {
//                   return await subcommand.action(exercise, options);
//                 } catch {
//                   return false;
//                 }
//               },
//             )
//           ) {
//             if (!result) failed = true;
//           }
//           if (failed) throw new CommandFailed(subcommand.command.name());
//         }),
//     );
//   }

//   command.parseOptions(Deno.args);
//   if (Object.keys(command.opts()).length === 0 && track.joined) {
//     const exercises = await track.exercises();
//     const subcommands = exercises.map((exercise) =>
//       exerciseCommand(exercism, exercise, command, parent)
//     );
//     for (const subcommand of subcommands) {
//       command.addCommand(subcommand, { hidden: true });
//     }
//   }

//   command.action(async () => {
//     const exercises = await track.exercises(filters());
//     if (
//       await processActionData(
//         exercism,
//         Object.keys(filters()).length === 0 ? { track } : { exercises },
//         parent,
//       )
//     ) return;
//     list(exercises);
//   });

//   return command;
// }

// function exerciseCommand(
//   exercism: Exercism,
//   exercise: Exercise,
//   parent: Command,
//   root: AppCommand,
// ): Command {
//   const command = parent
//     .createCommand(exercise.slug)
//     .copyInheritedSettings(parent)
//     .description(help.exercise(exercise).description)
//     .summary(help.exercise(exercise).summary);

//   for (const subcommand of exerciseCommands()) {
//     command.addCommand(
//       subcommand.command
//         .copyInheritedSettings(command)
//         .action(async (options) => {
//           if (!(await subcommand.action(exercise, options))) {
//             throw new CommandFailed(subcommand.command.name());
//           }
//         }),
//     );
//   }

//   command.action(async () => {
//     const solution = exercise.solution;
//     if (
//       await processActionData(exercism, {
//         exercise,
//         ...solution && { solution },
//       }, root)
//     ) return;
//     list([exercise]);
//   });
//   return command;
// }

// interface ExerciseCommand {
//   command: Command;
//   action: (
//     exercise: Exercise,
//     options: OptionValues,
//   ) => Promise<boolean | Solution>;
//   concurrency?: number;
// }

// function exerciseCommands(): ExerciseCommand[] {
//   return [
//     {
//       command: new Command("start")
//         .description(help.exercises.start.description)
//         .summary(help.exercises.start.summary),
//       action: async (exercise: Exercise) => await exercise.start(),
//     },
//     {
//       command: new Command("code")
//         .description(help.exercises.code.description)
//         .summary(help.exercises.code.summary),
//       action: async (exercise: Exercise) =>
//         await (await exercise.start()).code(),
//     },
//     {
//       command: new Command("format")
//         .description(help.exercises.format.description)
//         .summary(help.exercises.format.summary)
//         .addOption(new Option("--code", help.opts.code.check)),
//       action: async (exercise: Exercise, options: { code?: boolean }) =>
//         await (await exercise.start()).format(options),
//     },
//     {
//       command: new Command("lint")
//         .description(help.exercises.lint.description)
//         .summary(help.exercises.lint.summary)
//         .addOption(new Option("--code", help.opts.code.check)),
//       action: async (exercise: Exercise, options: { code?: boolean }) =>
//         await (await exercise.start()).lint(options),
//     },
//     {
//       command: new Command("test")
//         .description(help.exercises.test.description)
//         .summary(help.exercises.test.summary)
//         .addOption(new Option("--code", help.opts.code.check)),
//       action: async (exercise: Exercise, options: { code?: boolean }) =>
//         await (await exercise.start()).test(options),
//     },
//     {
//       command: new Command("diff")
//         .description(help.exercises.diff.description)
//         .summary(help.exercises.diff.summary)
//         .addOption(new Option("--code", help.opts.code.diff)),
//       action: async (exercise: Exercise, options: { code?: boolean }) =>
//         await (await exercise.start()).diff(options),
//     },
//     {
//       command: new Command("download")
//         .description(help.exercises.download.description)
//         .summary(help.exercises.download.summary)
//         .addOption(new Option("--force", help.opts.force.download)),
//       action: async (exercise: Exercise, options: { force?: boolean }) => {
//         if (await exercise.solution?.downloaded()) {
//           return await exercise.solution?.download(options) ?? false;
//         } else {
//           await exercise.start();
//           return true;
//         }
//       },
//     },
//     {
//       command: new Command("submit")
//         .description(help.exercises.submit.description)
//         .summary(help.exercises.submit.summary)
//         .addOption(new Option("--force", help.opts.force.submit))
//         .addOption(new Option("--complete", help.opts.complete))
//         .addOption(new Option("--publish", help.opts.publish)),
//       action: async (
//         exercise: Exercise,
//         options: { force?: boolean; complete?: boolean; publish?: boolean },
//       ) => await exercise.solution?.submit(options) ?? false,
//       concurrency: 4,
//     },
//     {
//       command: new Command("complete")
//         .description(help.exercises.complete.description)
//         .summary(help.exercises.complete.summary),
//       action: async (exercise: Exercise) =>
//         await exercise.solution?.complete() ?? false,
//       concurrency: 1,
//     },
//     {
//       command: new Command("publish")
//         .description(help.exercises.publish.description)
//         .summary(help.exercises.publish.summary),
//       action: async (exercise: Exercise) =>
//         await exercise.solution?.publish() ?? false,
//       concurrency: 1,
//     },
//     {
//       command: new Command("update")
//         .description(help.exercises.update.description)
//         .summary(help.exercises.update.summary),
//       action: async (exercise: Exercise) =>
//         await exercise.solution?.update() ?? false,
//       concurrency: 1,
//     },
//   ];
// }

// export async function processActionData(
//   exercism: Exercism,
//   elements: Record<string, null | Element | Element[]>,
//   command: AppCommand,
// ): Promise<boolean> {
//   const options = command.opts();
//   if (!options.sync && !options.json && !options.open) return false;
//   const flattened = Array.from(Object.values(elements)).flatMap((element) =>
//     element ? (element instanceof Array ? element : [element]) : []
//   );
//   if (options.open) await pool(flattened, (e) => exercism.open(e.url));
//   if (options.sync) await pool(flattened, (e) => e.reload());
//   if (options.json) console.info(JSON.stringify(elements, undefined, 2));
//   return true;
// }

// export function parseSlug(slug: string, previous?: string[]): string[] {
//   if (!GLOB_PATTERN.test(slug)) {
//     throw new InvalidArgumentError(messages.app.invalidSlug(slug));
//   }
//   previous = previous ?? [];
//   previous.push(slug);
//   return previous;
// }

// export async function main(
//   exercism: Exercism,
//   args: string[],
// ): Promise<number> {
//   try {
//     const command = await appCommand(exercism, args);
//     await command.parseAsync(args, { from: "user" });
//   } catch (error) {
//     if (error instanceof CommanderError) {
//       return error.exitCode ? 1 : 0;
//     } else if (error instanceof CommandFailed) {
//       return 3;
//     } else if (error instanceof InvalidConfig) {
//       return 4;
//     } else if (error instanceof AggregateError) {
//       for (const e of error.errors) {
//         console.error(messages.app.error(e));
//         console.debug(e.stack);
//       }
//       return 2;
//     } else if (error instanceof Error) {
//       console.error(messages.app.error(error));
//       console.debug(error.stack);
//       return 2;
//     }
//     throw error;
//   }
//   return 0;
// }

// if (import.meta.main) {
//   await using cfg = config<{ token: string }>();
//   let { token } = await cfg.get();
//   if (!token) {
//     const input = prompt(
//       messages.app.token("https://exercism.org/settings/api_cli").prompt,
//     );
//     if (!input) {
//       console.error(messages.app.token("exercism").missing);
//       Deno.exit(1);
//     }
//     // validate token
//     // GET /api/v2/validate_token
//     token = input;
//     await cfg.set({ token });
//   }
//   const client = exercism({ token });
//   Deno.exit(await main(client, Deno.args));
// }

if (import.meta.main) Deno.exit(await cli(Deno.args));
