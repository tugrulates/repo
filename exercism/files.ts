// deno-lint-ignore-file no-console
import { dirname, join, relative } from "@std/path";
import type { App } from "./app.ts";
import type { CacheGetOptions } from "./cache.ts";
import type { FilesData } from "./data.ts";
import { ApiElement } from "./data.ts";
import type { Exercise } from "./exercise.ts";
import { Shell } from "./shell.ts";
import type { Solution } from "./solution.ts";
import { messages } from "./strings.ts";
import type { Toolchain } from "./toolchain.ts";
import type { Track } from "./track.ts";

export class Files extends ApiElement<FilesData> {
  readonly app: App;
  readonly track: Track;
  readonly exercise: Exercise;

  constructor(readonly solution: Solution) {
    super();
    this.app = solution.app;
    this.track = solution.track;
    this.exercise = solution.exercise;
  }

  get path(): string {
    return join(this.track.path, this.exercise.slug);
  }

  override async url(): Promise<string> {
    return await this.solution.url();
  }

  async solutionFiles(): Promise<string[]> {
    return await Promise.all(
      (await this.data()).solution.map((file) => join(this.path, file)),
    );
  }

  async testFiles(): Promise<string[]> {
    return await Promise.all(
      (await this.data()).test.map((file) => join(this.path, file)),
    );
  }

  async editorFiles(): Promise<string[]> {
    return await Promise.all(
      (await this.data()).editor.map((file) => join(this.path, file)),
    );
  }

  name(file: string): string {
    return relative(this.path, file);
  }

  exists(file: string): Promise<boolean> {
    return Deno.stat(file).then(
      () => true,
      () => false,
    );
  }

  async downloaded(): Promise<boolean> {
    const exists = await Promise.all(
      (await this.solutionFiles()).map(async (file) => await this.exists(file)),
    );
    return exists.some((exists) => exists);
  }

  async setup(): Promise<boolean> {
    if (!(await this.downloaded())) {
      await this.download();
    }
    return (await this.exercise.track.toolchain()?.setup(this)) ?? true;
  }

  async code(): Promise<boolean> {
    await this.setup();
    console.debug(this.exercise.messages.code.progress);
    await this.app.code(await this.solutionFiles());
    return true;
  }

  async format(
    options: { quiet?: boolean; code?: boolean } = {},
  ): Promise<boolean> {
    return await this.runTool(
      (toolchain) => toolchain.format,
      this.exercise.messages.format,
      options,
    );
  }

  async lint(
    options: { quiet?: boolean; code?: boolean } = {},
  ): Promise<boolean> {
    return await this.runTool(
      (toolchain) => toolchain.lint,
      this.exercise.messages.lint,
      options,
    );
  }

  async test(
    options: { quiet?: boolean; code?: boolean } = {},
  ): Promise<boolean> {
    return await this.runTool(
      (toolchain) => toolchain.test,
      this.exercise.messages.test,
      options,
    );
  }

  private async runTool(
    tool: (
      toolchain: Toolchain,
    ) => (shell: Shell, files: Files) => Promise<void>,
    messages: { progress: string; success: string; failure: string },
    options: {
      quiet?: boolean;
      code?: boolean;
    },
  ): Promise<boolean> {
    const toolchain = this.exercise.track.toolchain();
    if (!toolchain) return true;
    console.debug(messages.progress);
    try {
      const shell = new Shell();
      await tool(toolchain)(shell, this);
      (options.quiet ? console.debug : console.log)(messages.success);
      return true;
    } catch {
      if (options.code) await this.code();
      console.error(messages.failure);
      return false;
    }
  }

  private async compareFile(
    file: string,
    before: string | null,
    after: string | null,
    { code = false } = {},
  ): Promise<boolean> {
    if (before === after) {
      console.debug(messages.file(file).notChanged);
      return true;
    }
    console.debug(messages.file(file).changed);

    if (code) {
      let tempDir: string | undefined;
      try {
        let beforeFile = "/dev/null";
        if (before !== null) {
          tempDir = await Deno.makeTempDir();
          beforeFile = join(tempDir, file);
          await Deno.writeTextFile(beforeFile, before);
        }
        const local = join(this.path, file);
        const afterFile = await this.exists(local) ? local : "/dev/null";
        await this.app.code([beforeFile, afterFile], { diff: true });
        return await this.compareFile(file, before, after, {
          code: false,
        });
      } finally {
        if (tempDir !== undefined) {
          await Deno.remove(tempDir, { recursive: true });
        }
      }
    }

    return false;
  }

  async diff({ quiet = false, code = false } = {}): Promise<boolean> {
    console.debug(this.exercise.messages.diff.progress);

    await this.setup();
    await this.sync();
    const beforeContents = new Map<string, string>();
    const afterContents = new Map<string, string>();

    // Downloaded contents.
    if (await this.solution.iterated()) {
      const result = await this.app.api
        .iterationFiles(this.solution)
        .then((files) => {
          for (const file of files) {
            if (file.filename === undefined || file.content === undefined) {
              console.error(this.exercise.messages.download.failure);
              return false;
            }
            if (file.type === "solution") {
              beforeContents.set(file.filename, file.content);
            }
          }
          return true;
        });
      if (!result) {
        return false;
      }
    }

    // Local contents.
    await Promise.all((await this.solutionFiles()).map(async (file) => {
      if (await this.exists(file)) {
        afterContents.set(this.name(file), await Deno.readTextFile(file));
      }
    }));

    // Compare.
    const allFiles = Array.from(
      new Set([...beforeContents.keys(), ...afterContents.keys()]),
    );
    const result = (
      await Promise.all(
        allFiles.map(
          async (file) =>
            await this.compareFile(
              file,
              beforeContents.get(file) ?? null,
              afterContents.get(file) ?? null,
              { code },
            ),
        ),
      )
    ).every((result) => result);

    if (!quiet) {
      if (result) {
        console.log(this.exercise.messages.diff.notChanged);
      } else {
        console.warn(this.exercise.messages.diff.changed);
      }
    }

    return result;
  }

  async download(options: { force?: boolean } = {}): Promise<boolean> {
    console.debug(this.exercise.messages.download.progress);
    const { force = false } = options;

    await this.sync();
    let changed = false;
    let kept = false;

    const data = await this.data();
    const serverFiles = (
      await Promise.all([
        (await this.solution.iterated())
          ? await this.app.api.iterationFiles(this.solution)
          : await Promise.all(
            [...data.solution, ...data.editor].map((file) =>
              this.app.api.submissionFile(this.solution, file)
            ),
          ),
        Promise.all(
          data.test.map((file) =>
            this.app.api.submissionFile(this.solution, file)
          ),
        ),
      ])
    ).flat();

    await Promise.all(serverFiles.map(async (file) => {
      if (file.filename === undefined || file.content === undefined) {
        console.error(this.exercise.messages.download.failure);
        return;
      }

      const fileMessages = messages.file(file.filename);
      const localFile = join(this.path, file.filename);
      if (!force && (await this.exists(localFile))) {
        if ((await Deno.readTextFile(localFile)) === file.content) {
          console.debug(fileMessages.notChanged);
          return;
        }
        if (!confirm(fileMessages.prompt.overwrite)) {
          console.log(fileMessages.skip);
          kept = true;
          return;
        }
      }

      changed = true;
      await Deno.mkdir(dirname(localFile), { recursive: true });
      await Deno.writeTextFile(localFile, file.content);
    }));

    if (kept) {
      console.warn(this.exercise.messages.download.partialSuccess);
    } else if (changed) {
      console.log(this.exercise.messages.download.success);
    } else {
      console.log(this.exercise.messages.download.skip);
    }
    return true;
  }

  override async data(options: CacheGetOptions = {}): Promise<FilesData> {
    return await this.app.api.files(this.solution, options);
  }
}
