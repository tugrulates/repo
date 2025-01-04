/**
 * Interact with Duolingo, the language learning platform.
 *
 * @module
 */

import { main } from "./main.ts";

export * from "./client.ts";
export * from "./data.ts";
export * from "./interaction.ts";
export * from "./types.ts";

if (import.meta.main) await main();
