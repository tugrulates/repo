import { join } from "@std/path";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertSnapshot } from "@std/testing/snapshot";
import { NOT_FOUND } from "./mock_server.ts";
import { assertFiles, cli, suite, type SuiteContext } from "./suite.ts";
import {
  createCompletion,
  createExercise,
  createProfile,
  createSubmission,
  createTestRun,
  createTrack,
} from "./test_data.ts";

describe(suite, "exercise", function () {
  let s: SuiteContext;

  const profile = createProfile();
  const track = createTrack({ slug: "typescript", is_joined: true });
  const exercise = createExercise({ track, exercise: { slug: "bob" } });
  const started = createExercise({
    ...exercise,
    solution: { status: "started" },
    files: {
      solution: [{
        filename: "bob.ts",
        type: "solution",
        content: [
          "export function bob():",
          '  return "Bob!"',
        ].join("\n"),
      }],
      test: [{
        filename: "bob_test.ts",
        content: [
          "import { describe, it, expect } from '@jest/globals'",
          "import { bob } from './bob.ts'",
          "describe('Bob', () => {",
          "  it('says bob', () => {",
          "    expect(bob()).toEqual('Bob!')",
          "  });",
          "});",
        ].join("\n"),
      }],
      editor: [{
        filename: "bob_data.ts",
        type: "readonly",
        content: 'export const BOB = "Bob"',
      }],
      example: [{
        filename: "bob_example.ts",
        content: 'export bob - () -> "Hello Bob"',
      }],
    },
  });
  const iterated = createExercise({
    ...started,
    solution: { status: "iterated" },
  });
  const completed = createExercise({
    ...iterated,
    solution: { status: "completed" },
  });
  const published = createExercise({
    ...completed,
    solution: { status: "published" },
    iteration: { is_published: true },
  });
  const publishedPreviousIteration = createExercise({
    ...completed,
    solution: { status: "published" },
    iteration: { is_published: false },
  });

  beforeEach(function (this: SuiteContext) {
    s = this;
  });

  describe("new", function () {
    beforeEach(function () {
      s.server
        .profile(profile)
        .tracks(track)
        .exercises(exercise)
        .onStart(exercise, started);
    });

    it("list", async function (t) {
      await cli(s, t, "typescript bob");
    });

    it("start", async function (t) {
      await cli(s, t, "typescript bob start");
    });

    it("diff", async function (t) {
      await cli(s, t, "typescript bob diff");
    });

    it("download", async function (t) {
      await cli(s, t, "typescript bob download");
      await assertFiles(s, t, started);
    });

    it("submit", async function (t) {
      await cli(s, t, "typescript bob submit");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("complete", async function (t) {
      await cli(s, t, "typescript bob complete");
    });

    it("publish", async function (t) {
      await cli(s, t, "typescript bob publish");
    });

    it("update", async function (t) {
      await cli(s, t, "typescript bob update");
    });
  });

  describe("started", function () {
    const submission = createSubmission("queued");
    beforeEach(function () {
      s.server
        .profile(profile)
        .tracks(track)
        .exercises(started)
        .onSubmit(started, started, submission)
        .onSubmit(started, started, submission)
        .onTestRun(started, submission, createTestRun("pass"))
        .onCreateIteration(started, iterated)
        .onComplete(iterated, completed)
        .onPublish(completed, published)
        .onUpdate(started, started);
    });

    it("list", async function (t) {
      await cli(s, t, "typescript bob");
    });

    it("start", async function (t) {
      await cli(s, t, "typescript bob start");
    });

    it("diff", async function (t) {
      await cli(s, t, "typescript bob diff");
    });

    it("download", async function (t) {
      await cli(s, t, "typescript bob download");
      await assertFiles(s, t, started);
    });

    it("download: redownload", async function (t) {
      await cli(s, t, "typescript bob download");
      await cli(s, t, "typescript bob download");
      await assertFiles(s, t, started);
    });

    it("download --force", async function (t) {
      await cli(s, t, "typescript bob download");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob download --force");
      await assertFiles(s, t, started);
    });

    it("download: skip", async function (t) {
      await cli(s, t, "typescript bob download");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob download", { confirm: false });
      await assertFiles(s, t, started);
    });

    it("download: overwrite", async function (t) {
      await cli(s, t, "typescript bob download");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob download", { confirm: true });
      await assertFiles(s, t, started);
    });

    it("download: failure", async function (t) {
      s.server.submissionFile(started, "bob.ts", NOT_FOUND);
      await cli(s, t, "typescript bob download");
    });

    it("submit", async function (t) {
      await cli(s, t, "typescript bob submit");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("submit: presubmit failure", async function (t) {
      await cli(s, t, "typescript bob download");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob submit");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("submit --force", async function (t) {
      await cli(s, t, "typescript bob download");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob submit --force");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("submit --complete", async function (t) {
      await cli(s, t, "typescript bob submit --complete");
    });

    it("submit --publish", async function (t) {
      await cli(s, t, "typescript bob submit --publish");
    });

    it("complete", async function (t) {
      await cli(s, t, "typescript bob complete");
    });

    it("publish", async function (t) {
      await cli(s, t, "typescript bob publish");
    });

    it("update", async function (t) {
      await cli(s, t, "typescript bob update");
    });
  });

  describe("iterated", function () {
    const submission = createSubmission("queued");
    beforeEach(function () {
      s.server
        .profile(profile)
        .tracks(track)
        .exercises(iterated)
        .onSubmit(iterated, iterated, submission)
        .onSubmit(iterated, iterated, submission)
        .onTestRun(iterated, submission, createTestRun("pass"))
        .onCreateIteration(iterated, iterated)
        .onComplete(iterated, completed)
        .onPublish(completed, published)
        .onUpdate(iterated, iterated);
    });

    it("list", async function (t) {
      await cli(s, t, "typescript bob");
    });

    it("start", async function (t) {
      await cli(s, t, "typescript bob start");
    });

    it("diff: same", async function (t) {
      await cli(s, t, "typescript bob download");
      await cli(s, t, "typescript bob diff");
    });

    it("diff: different", async function (t) {
      await cli(s, t, "typescript bob download");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob diff");
    });

    it("diff: missing local", async function (t) {
      s.server.exercises({
        ...iterated,
        files: {
          solution: [
            { filename: "bob1.ts", type: "solution", content: "content1" },
            { filename: "bob2.ts", type: "solution", content: "content2" },
          ],
          test: [],
          editor: [],
          example: [],
        },
      });
      await cli(s, t, "typescript bob download");
      Deno.remove(join(s.workspace, "typescript/bob/bob1.ts"));
      await cli(s, t, "typescript bob diff --code");
    });

    it("diff: missing server", async function (t) {
      s.server.exercises({
        ...iterated,
        files: {
          solution: [
            { filename: "bob1.ts", type: "solution", content: "content1" },
            { filename: "bob2.ts", type: "solution", content: "content2" },
          ],
          test: [],
          editor: [],
          example: [],
        },
      });
      await cli(s, t, "typescript bob download");
      s.server.exercises({
        ...iterated,
        files: {
          solution: [
            { filename: "bob1.ts", type: "solution", content: "content1" },
            { filename: "bob2.ts", type: "solution", content: "" },
          ],
          test: [],
          editor: [],
          example: [],
        },
      });
      await cli(s, t, "typescript bob diff --code");
    });

    it("diff: malformed", async function (t) {
      await cli(s, t, "typescript bob download");
      s.server.iterationFiles(started, [{}]);
      await cli(s, t, "typescript bob diff");
    });

    it("download", async function (t) {
      await cli(s, t, "typescript bob download");
      await assertFiles(s, t, started);
    });

    it("download: failure", async function (t) {
      s.server.iterationFiles(started, NOT_FOUND);
      await cli(s, t, "typescript bob download");
    });

    it("download: malformed", async function (t) {
      s.server.iterationFiles(started, [{}]);
      await cli(s, t, "typescript bob download");
    });

    it("submit", async function (t) {
      await cli(s, t, "typescript bob submit");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("complete", async function (t) {
      await cli(s, t, "typescript bob complete");
    });

    it("publish", async function (t) {
      await cli(s, t, "typescript bob publish");
    });

    it("update", async function (t) {
      await cli(s, t, "typescript bob update");
    });
  });

  describe("completed", function () {
    const submission = createSubmission("queued");
    beforeEach(function () {
      s.server
        .profile(profile)
        .tracks(track)
        .exercises(completed)
        .onSubmit(completed, completed, submission)
        .onSubmit(completed, completed, submission)
        .onTestRun(completed, submission, createTestRun("pass"))
        .onCreateIteration(completed, completed)
        .onPublish(completed, published)
        .onUpdate(completed, completed);
    });

    it("list", async function (t) {
      await cli(s, t, "typescript bob");
    });

    it("start", async function (t) {
      await cli(s, t, "typescript bob start");
    });

    it("diff", async function (t) {
      await cli(s, t, "typescript bob diff");
    });

    it("download", async function (t) {
      await cli(s, t, "typescript bob download");
      await assertFiles(s, t, started);
    });

    it("submit", async function (t) {
      await cli(s, t, "typescript bob submit");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("complete", async function (t) {
      await cli(s, t, "typescript bob complete");
    });

    it("publish", async function (t) {
      await cli(s, t, "typescript bob publish");
    });

    it("update", async function (t) {
      await cli(s, t, "typescript bob update");
    });
  });

  describe("published", function () {
    const submission = createSubmission("queued");
    beforeEach(function () {
      s.server
        .profile(profile)
        .tracks(track)
        .exercises(published)
        .onSubmit(published, published, submission)
        .onSubmit(published, published, submission)
        .onTestRun(published, submission, createTestRun("pass"))
        .onCreateIteration(published, published)
        .onUpdate(published, published);
    });

    it("list", async function (t) {
      await cli(s, t, "typescript bob");
    });

    it("start", async function (t) {
      await cli(s, t, "typescript bob start");
    });

    it("code", async function (t) {
      await cli(s, t, "typescript bob code");
    });

    it("diff", async function (t) {
      await cli(s, t, "typescript bob diff");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob diff");
    });

    it("diff --code", async function (t) {
      await cli(s, t, "typescript bob diff --code");
      Deno.writeTextFile(join(s.workspace, "typescript/bob/bob.ts"), '"bob"');
      await cli(s, t, "typescript bob diff --code");
    });

    it("download", async function (t) {
      await cli(s, t, "typescript bob download");
      await assertFiles(s, t, started);
    });

    it("submit", async function (t) {
      await cli(s, t, "typescript bob submit");
      await assertSnapshot(t, s.server.submittedFiles);
    });

    it("complete", async function (t) {
      await cli(s, t, "typescript bob complete");
    });

    it("publish", async function (t) {
      await cli(s, t, "typescript bob publish");
    });

    it("update", async function (t) {
      await cli(s, t, "typescript bob update");
    });
  });

  describe("outdated", function () {
    const outdated = createExercise({
      ...published,
      solution: { status: "published", is_out_of_date: true },
      iteration: { tests_status: "passed" },
    });
    const syncedPassing = createExercise({
      ...published,
      solution: { status: "published", is_out_of_date: false },
      iteration: { tests_status: "passed" },
    });
    const syncedFailing = createExercise({
      ...published,
      solution: { status: "published", is_out_of_date: false },
      iteration: { tests_status: "errored" },
    });

    beforeEach(function () {
      s.server.profile(profile).tracks(track).exercises(outdated);
    });

    it("update: passing", async function (t) {
      s.server.onUpdate(outdated, syncedPassing);
      await cli(s, t, "typescript bob update");
    });

    it("update: failing", async function (t) {
      s.server.onUpdate(outdated, syncedFailing);
      await cli(s, t, "typescript bob update");
    });
  });

  it("start: failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(exercise)
      .onStart(exercise, exercise);
    await cli(s, t, "typescript bob start");
  });

  it("server test: wait", async function (t) {
    const submission = createSubmission("queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("pass"))
      .onCreateIteration(started, iterated);
    await cli(s, t, "typescript bob submit");
  });

  it("server test: retry max attempts", async function (t) {
    const submission = createSubmission("queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("queued"));
    await cli(s, t, "typescript bob submit");
  });

  it("server test: not queued", async function (t) {
    const submission = createSubmission("not_queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onCreateIteration(started, iterated);
    await cli(s, t, "typescript bob submit");
  });

  it("server test: failure", async function (t) {
    const submission = createSubmission("queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("queued"))
      .onTestRun(started, submission, createTestRun("fail"));
    await cli(s, t, "typescript bob submit");
  });

  it("server test: failure but no tests", async function (t) {
    const submission = createSubmission("queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, { status: "fail" });
    await cli(s, t, "typescript bob submit");
  });

  it("server test: timeout", async function (t) {
    const submission = createSubmission("queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("timeout"));
    await cli(s, t, "typescript bob submit");
  });

  it("server test: cancelled", async function (t) {
    const submission = createSubmission("queued");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("cancelled"));
    await cli(s, t, "typescript bob submit");
  });

  it("submit: failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, {})
      .onSubmit(started, started, {});
    await cli(s, t, "typescript bob submit");
  });

  it("submit: create iteration failure", async function (t) {
    const submission = createSubmission("passed");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("pass"))
      .onCreateIteration(started, started);
    await cli(s, t, "typescript bob submit");
  });

  it("submit --complete: failure", async function (t) {
    const submission = createSubmission("passed");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("pass"))
      .onCreateIteration(started, iterated)
      .onComplete(iterated, iterated);
    await cli(s, t, "typescript bob submit --complete");
  });

  it("submit --publish: failure", async function (t) {
    const submission = createSubmission("passed");
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, submission)
      .onSubmit(started, started, submission)
      .onTestRun(started, submission, createTestRun("pass"))
      .onCreateIteration(started, iterated)
      .onComplete(iterated, completed)
      .onPublish(completed, completed);
    await cli(s, t, "typescript bob submit --publish");
  });

  it("complete: unlock exercises", async function (t) {
    const alice = createExercise({
      track,
      exercise: { slug: "alice", is_unlocked: false },
    });
    const charlie = createExercise({
      track,
      exercise: { slug: "charlie", is_unlocked: false },
    });
    s.server
      .tracks(track)
      .exercises(iterated, alice, charlie)
      .onComplete(
        iterated,
        completed,
        { completion: createCompletion(iterated), unlocked: [alice, charlie] },
      );
    await cli(s, t, "typescript bob complete");
  });

  it("complete: failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(iterated)
      .onComplete(iterated, iterated);
    await cli(s, t, "typescript bob complete");
  });

  it("publish: all iterations", async function (t) {
    s.server
      .tracks(track)
      .exercises(publishedPreviousIteration)
      .onPublish(publishedPreviousIteration, publishedPreviousIteration)
      .onPublishIteration(publishedPreviousIteration, published);
    await cli(s, t, "typescript bob publish");
  });

  it("publish: publish iterations failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(publishedPreviousIteration)
      .onPublish(publishedPreviousIteration, publishedPreviousIteration)
      .onPublishIteration(
        publishedPreviousIteration,
        publishedPreviousIteration,
      );
    await cli(s, t, "typescript bob publish");
  });

  it("publish: create iteration failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(started)
      .onSubmit(started, started, createSubmission("not_queued"))
      .onSubmit(started, started, createSubmission("not_queued"))
      .onCreateIteration(started, started);
    await cli(s, t, "typescript bob publish");
  });

  it("publish: complete failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(iterated)
      .onComplete(iterated, iterated);
    await cli(s, t, "typescript bob publish");
  });

  it("publish: failure", async function (t) {
    s.server
      .tracks(track)
      .exercises(completed)
      .onPublish(completed, completed);
    await cli(s, t, "typescript bob publish");
  });

  it("deleted exercise", async function (t) {
    s.server.tracks(track).exercises(completed);
    await cli(s, t, "typescript bob download");
    s.server.reset();
    s.server.tracks(track).exercises();
    await cli(s, t, "typescript -e bob --sync");
  });
});
