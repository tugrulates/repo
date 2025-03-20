// deno-lint-ignore-file no-console
import { CommandFailed } from "./error.ts";
import type { Files } from "./files.ts";
import { generated, messages } from "./strings.ts";

export abstract class Toolchain {
  async setup(_files: Files): Promise<boolean> {
    return await Promise.resolve(true);
  }
  abstract format(files: Files): Promise<void>;
  abstract lint(files: Files): Promise<void>;
  abstract test(files: Files): Promise<void>;
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

  async format(files: Files): Promise<void> {
    await new Shell().run("ruff", "format", ...(await files.solutionFiles()));
  }

  async lint(files: Files): Promise<void> {
    await new Shell().run("ruff", "check", ...(await files.solutionFiles()));
    await new Shell().run("mypy", ...(await files.solutionFiles()));
    await new Shell().run("pylint", ...(await files.solutionFiles()));
  }

  async test(files: Files): Promise<void> {
    await new Shell().run("pytest", ...(await files.testFiles()));
  }
}

export const TOOLCHAINS: Record<string, Toolchain> = {
  python: new Python(),
};

class Shell {
  constructor(
    readonly options: Deno.CommandOptions = {},
  ) {}

  async run(cmd: string, ...args: string[]): Promise<string> {
    const command = new Deno.Command(cmd, { args, ...this.options });
    const { code, stdout, stderr } = await command.output();
    const [output, error] = [
      new TextDecoder().decode(stdout).trimEnd(),
      new TextDecoder().decode(stderr).trimEnd(),
    ];
    if (output.length > 0) console.debug(output);
    if (error.length > 0) console.debug(error);
    if (code === 0) return output;
    throw new CommandFailed(`${args.join(" ")}\n${error}`);
  }
}
