import type { Command, Example } from "@cliffy/command";
import $ from "@david/dax";
import { exists } from "@std/fs";
import { basename, resolve } from "@std/path";
import { join } from "@std/path/join";

interface Config {
  name: string;
  exports: string | Record<string, string>;
}

interface JSDoc {
  nodes: JSDocNode[];
}

interface JSDocNode {
  name: string;
  kind: string;
  jsDoc: {
    doc: string;
  };
  variableDef?: {
    kind: string;
  };
}

async function getModuleConfig(path: string): Promise<Config> {
  return JSON.parse(await Deno.readTextFile(join(path, "deno.json")));
}

function getExports(path: string, config: Config): string[] {
  if (typeof config.exports === "string") return [join(path, config.exports)];
  return Object.values(config.exports).map((e) => join(path, e));
}

async function getCommand(path: string): Promise<Command | null> {
  const entrypoint = resolve(path, "main.ts");
  if (!await exists(entrypoint)) return null;
  const cli = await import(entrypoint);
  return cli.getCommand() as Command;
}

function getExamples(command: Command): Example[] {
  return [
    ...command.getExamples(),
    ...command.getCommands().map((c) => getExamples(c)).flat(),
  ];
}

async function getJsdoc(path: string, config: Config): Promise<{
  module?: JSDocNode;
  classes: JSDocNode[];
  functions: JSDocNode[];
  types: JSDocNode[];
  constants: JSDocNode[];
}> {
  // Deno.command instead of dax
  // see https://github.com/dsherret/dax/issues/297
  const command = new Deno.Command("deno", {
    args: ["doc", "--json", ...getExports(path, config)],
  });
  const { code, stdout, stderr } = await command.output();
  if (code !== 0) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Cannot parse JSDoc: ${error}`);
  }
  const jsdoc = JSON.parse(new TextDecoder().decode(stdout)) as JSDoc;
  const nodes = jsdoc.nodes.toSorted((a, b) => a.name.localeCompare(b.name));
  return {
    module: nodes.find((n) => n.kind == "moduleDoc"),
    classes: nodes.filter((n) => n.kind == "class"),
    functions: nodes.filter((n) => n.kind == "function"),
    types: nodes.filter((n) => n.kind == "interface"),
    constants: nodes.filter((n) => n.kind == "variable")
      .filter((n) => n.variableDef?.kind == "const"),
  };
}

/**
 * Generate a README.md file for a module.
 *
 * Alternatively, running this file with `deno run` can be used to generate
 * README.md files for a list of module.
 *
 * @param path The path to the module.
 * @returns The README.md file content.
 */
export async function generateReadme(path: string): Promise<string> {
  const name = basename(path);
  const [config, command] = await Promise.all([
    getModuleConfig(path),
    getCommand(path),
  ]);
  const jsdoc = await getJsdoc(path, config);

  const readme = [
    `# ${name} ([jsr.io](https://jsr.io/${config.name}))`,
    "",
    jsdoc.module?.jsDoc?.doc,
  ];
  if (command) {
    const cli = {
      name: command.getName(),
      examples: getExamples(command),
    };
    readme.push(
      "## CLI",
      "",
      `Run \`${cli.name}\` after installation, or run \`deno run -A ${config.name}\` without installation.`,
      "",
      "### Examples",
      "",
      "| Command | Description |",
      "| ------- | ----------- |",
      ...cli.examples.map((e) =>
        `| \`${e.name.replace("|", "\\|")}\` | ${
          e.description.replace("|", "\\|")
        } |`
      ),
      "",
    );
  }
  if (jsdoc.classes?.length) {
    readme.push("## Classes", "");
    for (const c of jsdoc.classes) {
      readme.push(
        `### [${c.name}](https://jsr.io/${config.name}/doc/~/${c.name})`,
        "",
        c.jsDoc?.doc,
      );
    }
  }
  if (jsdoc.types?.length) {
    readme.push("## Types", "");
    for (const c of jsdoc.types) {
      readme.push(
        `### [${c.name}](https://jsr.io/${config.name}/doc/~/${c.name})`,
        "",
        c.jsDoc?.doc,
      );
    }
  }
  if (jsdoc.functions?.length) {
    readme.push("## Functions", "");
    for (const f of jsdoc.functions) {
      readme.push(
        `### [${f.name}](https://jsr.io/${config.name}/doc/~/${f.name})`,
        "",
        f.jsDoc?.doc,
      );
    }
  }
  if (jsdoc.constants?.length) {
    readme.push("## Constants", "");
    for (const c of jsdoc.constants) {
      readme.push(
        `### [${c.name}](https://jsr.io/${config.name}/doc/~/${c.name})`,
        "",
        c.jsDoc?.doc,
      );
    }
  }

  return readme.join("\n");
}

if (import.meta.main) {
  await Promise.all(Deno.args.map(async (module) => {
    const readme = await generateReadme(module);
    const file = join(module, "README.md");
    await Deno.writeTextFile(file, readme);
    await $`deno fmt -q ${file}`;
  }));
}
