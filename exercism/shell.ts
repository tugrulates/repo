// deno-lint-ignore-file no-console
import { CommandFailed } from "./error.ts";

export class Shell {
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
