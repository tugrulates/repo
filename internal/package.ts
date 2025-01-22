import { pick } from "@std/collections";
import { dirname, fromFileUrl, join } from "@std/path";

/** Information about a Deno package. */
export interface Package {
  /** Package name. */
  name?: string;
  /** Package version. */
  version?: string;
}

/** Return information about the running package using `deno.json`. */
export async function getPackage(): Promise<Package> {
  return pick(
    JSON.parse(
      await Deno.readTextFile(
        fromFileUrl(join(dirname(Deno.mainModule), "deno.json")),
      ),
    ) as Package,
    ["name", "version"],
  );
}
