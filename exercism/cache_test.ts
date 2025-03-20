import { assertExists } from "@std/assert/exists";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { cli, suite, type SuiteContext } from "./suite.ts";
import { createProfile } from "./test_data.ts";

describe(suite, "cache", function () {
  let s: SuiteContext;

  const profile = createProfile();

  beforeEach(function (this: SuiteContext) {
    s = this;
    s.server.profile(profile);
  });

  it("cache", async function (t) {
    await cli(s, t, "profile --json");
    await cli(s, t, "profile --sync --json");
    assertExists(s.cachePath);
    await Deno.remove(s.cachePath);
    await cli(s, t, "profile --json");
    await cli(s, t, "profile --sync --json");
  });
});
