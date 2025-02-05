import { assertSnapshot } from "@std/testing/snapshot";
import { gitRepo } from "@tugrulates/internal/git";
import {
  createPullRequest,
  findPullRequests,
} from "@tugrulates/internal/github";
import { getMockMode, mockFetch, tempDir } from "@tugrulates/testing";

// @todo Fix the timer leaks.
// https://github.com/SGrondin/bottleneck/issues/225s

Deno.test.ignore("createPullRequest() creates PR", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using _fetch = mockFetch(t);

  await using directory = await tempDir();
  const repo = gitRepo({ directory: directory.path });

  if (getMockMode() === "update") {
    await repo.clone("https://github.com/tugrulates/dotfiles.git");
    await repo.checkout({ newBranch: "test" });
    await repo.commit("test commit", { sign: false });
    await repo.push();
  } else {
    await repo.init();
    await repo.addRemote("https://github.com/tugrulates/dotfiles.git");
  }

  const pr = await createPullRequest(
    {
      directory: repo.directory,
      head: "test",
      base: "main",
      token: Deno.env.get("GITHUB_TOKEN") ?? "",
      title: "created by test",
      body: "Please delete me.",
      draft: true,
    },
  );
  await assertSnapshot(t, pr);
});

Deno.test("findPullRequests() returns open PRs", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using _fetch = mockFetch(t);
  const prs = await findPullRequests();
  await assertSnapshot(t, prs);
});

Deno.test("findPullRequests() finds PRs by title", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using _fetch = mockFetch(t);
  const prs = await findPullRequests({
    state: "all",
    title: "ci: automated releases",
  });
  await assertSnapshot(t, prs);
});
