import { beforeEach, describe, it } from "@std/testing/bdd";
import { cli, suite, type SuiteContext } from "./suite.ts";
import { createProfile } from "./test_data.ts";

describe(suite, "profile", function () {
  let s: SuiteContext;

  const profile = createProfile();

  beforeEach(function (this: SuiteContext) {
    s = this;
    s.server.profile(profile);
  });

  it("list", async function (t) {
    await cli(s, t, "profile");
  });

  it("list: malformed", async function (t) {
    s.server.profile({});
    await cli(s, t, "profile");
  });
});
