// deno-lint-ignore-file no-console
import { unicodeWidth } from "@std/cli";
import process from "node:process";
import { isatty } from "node:tty";
import terminalLink from "terminal-link";
import type { Exercise } from "./exercise.ts";
import { Profile } from "./profile.ts";
import { display } from "./strings.ts";
import { Track } from "./track.ts";

interface RichCell {
  text: string;
  align: "left" | "right";
  url: string | null;
}
type Cell = string | RichCell;

interface Row {
  cells: Cell[];
  writer: (...text: string[]) => void;
  style?: string;
}

export async function list(
  items: (Profile | Track | Exercise)[],
): Promise<void> {
  const rows = await Promise.all(
    items.map(async (item) =>
      item instanceof Profile
        ? await profileRow(item)
        : item instanceof Track
        ? await trackRow(item)
        : await exerciseRow(item)
    ),
  );

  const widths = rows.reduce((widths: number[], row: Row) => {
    row.cells.forEach(
      (cell, i) => (widths[i] = Math.max(
        unicodeWidth(render(cell, false)),
        widths[i] ?? 0,
      )),
    );
    return widths;
  }, []);

  for (const row of rows) {
    const text = row.cells.map((c, i) =>
      render(c, isatty(process.stdout.fd), widths[i])
    ).join(" ").trimEnd();
    if (row.style) {
      row.writer(`%c${text}`, row.style);
    } else {
      row.writer(text);
    }
  }
}

async function profileRow(profile: Profile): Promise<Row> {
  const messages = await display.profile(profile);
  return log(messages.handle, right(messages.reputation));
}

async function trackRow(track: Track): Promise<Row> {
  const messages = await display.track(track);
  const alert = (await track.hasNotifications())
    ? link(display.notification, await track.url())
    : "";
  if (await track.completed()) {
    return log(messages.completed, alert, right(messages.numExercises));
  } else if (await track.isJoined()) {
    return log(messages.joined, alert, right(messages.numCompleted));
  } else {
    return log(messages.notJoined, alert, right(messages.numExercises));
  }
}

async function exerciseRow(exercise: Exercise): Promise<Row> {
  const solution = await exercise.solution();
  const iteration = await solution?.iteration();
  const messages = await display.exercise(exercise, solution, iteration);
  const cells = [
    link(messages.status, await solution?.url()),
    link(messages.feedback, await iteration?.url()),
    link(messages.tests, await iteration?.url()),
    link(messages.social, await solution?.url()),
  ];
  if (!(await exercise.track.isJoined())) {
    return log(messages.notJoined, ...cells);
  } else if (!(await exercise.unlocked())) {
    return log(messages.locked, ...cells);
  } else if (!(await exercise.started())) {
    return log(messages.new, ...cells);
  } else if (solution && !(await solution.completed())) {
    return log(messages.started, ...cells);
  } else if ((await iteration?.failing()) ?? false) {
    return error(messages.failing, ...cells);
  } else if ((await iteration?.hasAutomatedFeedback()) ?? false) {
    return warn(messages.hasFeedback, ...cells);
  } else if (iteration && !(await iteration.passing())) {
    return log(messages.noTestResults, ...cells);
  } else {
    return log(messages.completed, ...cells);
  }
}

function link(text: string, url?: string): Cell {
  return url !== undefined ? { text, url, align: "left" } : text;
}

function right(text: Cell): RichCell {
  const cell = typeof text === "string" ? { text, url: null } : text;
  return { ...cell, align: "right" };
}

function render(cell: Cell, links: boolean, width?: number): string {
  const {
    text,
    align,
    url = null,
  } = typeof cell === "string" ? { text: cell, align: "left" } : cell;

  if (width !== undefined) {
    const bare = render(cell, false);
    const pad = " ".repeat(width - unicodeWidth(bare));
    const unpadded = links ? render(cell, links) : bare;
    return align === "left" ? unpadded + pad : pad + unpadded;
  }

  return !links || url === null ? text : terminalLink(text, url);
}

function log(...cells: Cell[]): Row {
  return { cells: cells, writer: console.log };
}

function warn(...cells: Cell[]): Row {
  return { cells: cells, writer: console.warn, style: "color: yellow" };
}

function error(...cells: Cell[]): Row {
  return { cells: cells, writer: console.error, style: "color: red" };
}
