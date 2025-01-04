/**
 * Interactions with Duolingo, the language learning platform.
 *
 * Provides classes and types, as well as a CLI interface.
 *
 * @module
 */

import { main } from "./main.ts";

export * from "./client.ts";
export * from "./data.ts";
export * from "./interaction.ts";
export * from "./types.ts";

if (import.meta.main) await main();
