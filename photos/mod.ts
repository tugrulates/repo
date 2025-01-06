/**
 * Photography editing and publishing workflow.
 *
 * The binary for `exiftool` is bundled with this library. However, the
 * compiled binary `photos` requires `exiftool` to be present in the system.
 * For macOS, it can be installed using Homebrew with `brew install exiftool`.
 * For other systems, see the [official website](https://exiftool.org/).
 *
 * @module
 */

import { main } from "./main.ts";

export * from "./photo.ts";
export * from "./types.ts";

if (import.meta.main) await main();
