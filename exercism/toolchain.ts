// deno-lint-ignore-file no-console
import type { Files } from "./files.ts";
import type { Shell } from "./shell.ts";
import { generated, messages } from "./strings.ts";

export abstract class Toolchain {
  async setup(_files: Files): Promise<boolean> {
    return await Promise.resolve(true);
  }
  abstract format(shell: Shell, files: Files): Promise<void>;
  abstract lint(shell: Shell, files: Files): Promise<void>;
  abstract test(shell: Shell, files: Files): Promise<void>;
}

class Python extends Toolchain {
  override async setup(files: Files): Promise<boolean> {
    const doc = `"""${await generated.toolchain.docComment(files.exercise)}"""`;
    await Promise.all((await files.solutionFiles()).map(async (file) => {
      const lines = (await Deno.readTextFile(file)).split("\n");
      if (lines[0] === doc) return;
      console.debug(messages.file(files.name(file)).docgen);
      if (/^""".*"""$/.exec(lines[0] ?? "")) {
        lines.shift();
      }
      lines.unshift(doc);
      await Deno.writeTextFile(file, lines.join("\n"));
    }));
    return true;
  }

  async format(shell: Shell, files: Files): Promise<void> {
    await shell.run("ruff", "format", ...(await files.solutionFiles()));
  }

  async lint(shell: Shell, files: Files): Promise<void> {
    await shell.run("ruff", "check", ...(await files.solutionFiles()));
    await shell.run("mypy", ...(await files.solutionFiles()));
    await shell.run("pylint", ...(await files.solutionFiles()));
  }

  async test(shell: Shell, files: Files): Promise<void> {
    await shell.run("pytest", ...(await files.testFiles()));
  }
}

export const TOOLCHAINS: Record<string, Toolchain> = {
  python: new Python(),
};
