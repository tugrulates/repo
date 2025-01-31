import { assertSnapshot } from "@std/testing/snapshot";
import {
  gitAddRemote,
  gitCheckout,
  gitClone,
  gitCommit,
  gitInit,
  gitPushCommits,
} from "@tugrulates/internal/git";
import {
  createPullRequest,
  findPullRequests,
} from "@tugrulates/internal/github";
import { getMockMode, mockFetch, tempDir } from "@tugrulates/testing";

// @todo Fix the timer leaks.
// https://github.com/SGrondin/bottleneck/issues/225s

Deno.test("createPullRequest() creates PR", {
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  using _fetch = mockFetch(t);

  await using repo = await tempDir();

  if (getMockMode() === "update") {
    await gitClone("https://github.com/tugrulates/dotfiles.git", {
      dir: repo.path,
      user: { name: "name", email: "email" },
    });
    await gitCheckout({ dir: repo.path, newBranch: "test" });
    await gitCommit({ dir: repo.path, message: "test commit" });
    await gitPushCommits({ dir: repo.path });
  } else {
    await gitInit({ dir: repo.path, user: { name: "name", email: "email" } });
    await gitAddRemote("https://github.com/tugrulates/dotfiles.git", {
      dir: repo.path,
    });
  }

  const pr = await createPullRequest(
    {
      dir: repo.path,
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
