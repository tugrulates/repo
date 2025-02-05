import { gitRepo } from "@tugrulates/internal/git";
import { Octokit } from "octokit";

/** @todo Wrap return values in better types. */

/** Options for using GitHub. */
export interface GitHubOptions {
  /** Local repository directory to manage. Default is current working directory. */
  directory?: string;
  /** API token for GitHub. */
  token?: string;
}

/** A GitHub user. */
export interface GitHubUser {
  /** Profile URL. */
  url: string;
  /** GitHub user name. */
  login: string;
}

/** A GitHub repository. */
export interface GitHubRepo {
  /** Repository URL. */
  url: string;
  /** Repository owner. */
  owner: GitHubUser;
  /** Repository name, without the user part. */
  name: string;
  /** Repository name, in `user/name` format. */
  // deno-lint-ignore camelcase
  full_name: string;
  /** Whether the repository is private. */
  private: boolean;
  /** Whether the repository is a fork. */
  fork: boolean;
}

/** A GitHub commit ref. */
export interface GitHubRef {
  /** Branch name or commit hash. */
  ref: string;
}

/** A GitHub pull request for a repository. */
export interface PullRequest {
  /** Pull request URL. */
  // deno-lint-ignore camelcase
  html_url: string;
  /** Pull request number. */
  number: number;
  /** Pull request title. */
  title: string;
  /** Pull request body. */
  body: string | null;
  /** Pull request state. */
  state: string;
  /** Pull request base branch. */
  base: GitHubRef;
  /** Pull request head branch. */
  head: GitHubRef;
  /** Whether the pull request is a draft. */
  draft?: boolean;
  /** Whether the pull request is locked. */
  locked: boolean;
  /** Pull request creation date. */
  // deno-lint-ignore camelcase
  created_at: string;
  /** Pull request last update date. */
  // deno-lint-ignore camelcase
  updated_at: string;
}

const REMOTE_URL_PATTERN =
  /^(?<protocol>https:\/\/|git@)(?<host>[^:/]+)[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/;

/** Gets the owner and repository name from the remote URL. */
export function parseRemote(remote: string): { owner: string; repo: string } {
  const match = remote.match(REMOTE_URL_PATTERN);
  if (
    match?.groups?.host !== "github.com" ||
    !match.groups.owner ||
    !match.groups.repo
  ) {
    throw new Error(`Invalid remote URL: ${remote}`);
  }
  return { owner: match.groups.owner, repo: match.groups.repo };
}

/** Options for creating a pull request. */
export interface CreatePullRequestOptions extends GitHubOptions {
  /** Title of the pull request. Default is the title of the first commit in PR. */
  title?: string;
  /** Body of the pull request. Default is the body of the first commit in PR. */
  body?: string;
  /** Branch to merge into the base branch. Default is the current branch. */
  head?: string;
  /** Base branch to merge into. Default is the remote base branch. */
  base?: string;
  /** Whether the pull request is a draft. */
  draft?: boolean;
}

/** Creates a pull request on GitHub. */
export async function createPullRequest(
  options?: CreatePullRequestOptions,
): Promise<PullRequest> {
  const local = gitRepo(options);
  const repo = parseRemote(await local.remote());
  const head = options?.head ?? await local.branch();
  if (!head) throw new Error("Cannot determine PR branch in detached HEAD");
  const base = options?.base ?? await local.remoteBase();
  if (!base) throw new Error("Cannot determine remote base branch");
  const commit = !options?.title
    ? (await local.log({ range: { from: base } })).pop()
    : undefined;
  const title = options?.title ?? commit?.summary;
  const body = options?.body ?? commit?.body;
  const octokit = new Octokit({ auth: options?.token });
  const response = await octokit.rest.pulls.create({
    ...repo,
    head,
    base,
    ...title ? { title } : {},
    ...body ? { body } : {},
    ...options?.draft ? { draft: options?.draft } : {},
  });
  return response.data;
}

/** Updates a pull request on GitHub. */
export async function updatePullRequest(
  pr: PullRequest,
  options?: GitHubOptions,
): Promise<PullRequest> {
  const local = gitRepo(options);
  const repo = parseRemote(await local.remote());
  const octokit = new Octokit({ auth: options?.token });
  const response = await octokit.rest.pulls.update({
    ...repo,
    pull_number: pr.number,
    base: pr.base.ref,
    title: pr.title,
    ...pr.body !== null ? { body: pr.body } : {},
    ...pr.state === "open" ? { state: "open" } : {},
    ...pr.state === "closed" ? { state: "closed" } : {},
    ...pr.draft !== undefined ? { draft: pr.draft } : {},
  });
  return response.data;
}

/** Options for finding pull requests. */
export interface FindPullRequestOptions extends GitHubOptions {
  /** Only return pull requests whose title is an exact match. */
  title?: string;
  /** Only return pull requests with the specified state. */
  state?: "open" | "closed" | "all";
  /** Only return pull requests with the specified head branch. */
  head?: string;
  /** Only return pull requests for the specified base branch. */
  base?: string;
  /** How the returned pull requests should be sorted. */
  sort?: "created" | "updated" | "popularity" | "long-running";
  /** The direction in which to sort the pull requests. */
  direction?: "asc" | "desc";
}

/**
 * Find pull requests on GitHub.
 *
 * This only returns the first page of results.
 *
 * @todo Implement pagination to get more results.
 */
export async function findPullRequests(
  options?: FindPullRequestOptions,
): Promise<PullRequest[]> {
  const local = gitRepo(options);
  const repo = parseRemote(await local.remote());
  const octokit = new Octokit({ auth: options?.token });
  const response = await octokit.rest.pulls.list({ ...repo, ...options });
  return response.data.filter((pr) =>
    !options?.title || pr.title === options.title
  );
}

/** A GitHub release for a repository. */
export interface Release {
  /** Release URL. */
  // deno-lint-ignore camelcase
  html_url: string;
  /** Release ID. */
  id: number;
  /** Release name. */
  name: string | null;
  /** Release body. */
  body?: string | null;
  /** Release tag name. */
  // deno-lint-ignore camelcase
  tag_name: string;
  /** Release author. */
  author: GitHubUser;
  /** Whether the relase is a draft. */
  draft: boolean;
  /** Whether the release is a prerelease. */
  prerelease: boolean;
  /** Release target branch or commit. */
  // deno-lint-ignore camelcase
  target_commitish: string;
  /** Release creation date. */
  // deno-lint-ignore camelcase
  created_at: string;
  /** Release last update date. */
  // deno-lint-ignore camelcase
  updated_at?: string;
}

/** Options for creating releases on GitHub. */
export interface CreateReleaseOptions extends GitHubOptions {
  /** Name of the release. */
  name?: string;
  /** Body of the release. */
  body?: string;
  /** Mark release as draft. */
  draft?: boolean;
  /** Mark release as prerelease. */
  prerelease?: boolean;
  /** Mark release as latest. */
  latest?: boolean;
  /** Target branch or full commit hash. */
  // deno-lint-ignore camelcase
  target_committish?: string;
}

/** Creates a release for a tag on GitHub. */
export async function createRelease(
  tag: string,
  options?: CreateReleaseOptions,
): Promise<Release> {
  const local = gitRepo(options);
  const repo = parseRemote(await local.remote());
  const octokit = new Octokit({ auth: options?.token });
  const response = await octokit.rest.repos.createRelease({
    ...repo,
    tag_name: tag,
    ...options?.name ? { name: options.name } : {},
    ...options?.body ? { body: options.body } : {},
    ...options?.draft ? { draft: options?.draft } : {},
    ...options?.prerelease ? { prerelease: options?.prerelease } : {},
    ...options?.latest
      ? { make_latest: options?.latest ? "true" : "false" }
      : {},
    ...options?.target_committish
      ? { target_commitish: options.target_committish }
      : {},
  });
  return response.data;
}

/** Options for updating releases on GitHub. */
export interface UpdateReleaseOptions extends GitHubOptions {
  /** Mark release as latest. */
  latest?: boolean;
}

/** Creates a release for a tag on GitHub. */
export async function updateRelease(
  release: Release,
  options?: UpdateReleaseOptions,
): Promise<Release> {
  const local = gitRepo(options);
  const repo = parseRemote(await local.remote());
  const octokit = new Octokit({ auth: options?.token });
  const response = await octokit.rest.repos.updateRelease({
    ...repo,
    release_id: release.id,
    tag_name: release.tag_name,
    ...release.name ? { name: release.name } : {},
    ...release.body ? { body: release.body } : {},
    draft: release.draft,
    prerelease: release.prerelease,
    ...options?.latest
      ? { make_latest: options?.latest ? "true" : "false" }
      : {},
    target_commitish: release.target_commitish,
  });
  return response.data;
}

/** Options for finding releases on GitHub. */
export interface FindReleaseOptions extends GitHubOptions {
  /** Only return releases with the specified tag. */
  tag?: string;
  /** Only return releases that are draft (when true) or published (when false). */
  draft?: boolean;
}

/**
 * Finds releases for a tag on GitHub.
 *
 * This only returns the first page of results.
 *
 * @todo Implement pagination to get more results.
 */
export async function findReleases(
  options?: FindReleaseOptions,
): Promise<Release[]> {
  const local = gitRepo(options);
  const repo = parseRemote(await local.remote());
  const octokit = new Octokit({ auth: options?.token });
  const response = await octokit.rest.repos.listReleases({ ...repo });
  return response.data
    .filter((release) => !options?.tag || release.tag_name === options.tag)
    .filter((release) =>
      options?.draft === undefined || release.draft === options.draft
    );
}
