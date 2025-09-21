import { assertEquals, assertExists, assertGreater } from "@std/assert";
import {
  testCompletionData,
  testConceptData,
  testConceptProgressionData,
  testExerciseData,
  testFileContent,
  testFilesData,
  testIterationData,
  testReputationData,
  testReputationMeta,
  testSolutionData,
  testSubmissionData,
  testTestResultData,
  testTestRunData,
  testTrackData,
  testUserData,
} from "./testing.ts";

Deno.test("testUser() creates a test user", () => {
  const data = testUserData({ handle: "handle" });
  assertEquals(data.handle, "handle");
});

Deno.test("testReputationData() creates a test reputation", () => {
  const data = testReputationData({ text: "text" });
  assertEquals(data.text, "text");
});

Deno.test("testReputationMeta() creates a test reputation meta", () => {
  const data = testReputationMeta({ total_reputation: 123 });
  assertEquals(data.total_reputation, 123);
});

Deno.test("testTrackData() creates a test track", () => {
  const data = testTrackData({ slug: "track" });
  assertEquals(data.slug, "track");
  assertEquals(data.title, "Track");
});

Deno.test("testExerciseData() creates a test exercise", () => {
  const data = testExerciseData({ slug: "exercise" });
  assertEquals(data.slug, "exercise");
  assertEquals(data.title, "Exercise");
});

Deno.test("testConceptData() creates a test concept", () => {
  const data = testConceptData({ slug: "concept" });
  assertEquals(data.slug, "concept");
  assertEquals(data.name, "Concept");
});

Deno.test("testTaskData() creates a test task", () => {
  const data = testTrackData({ title: "title" });
  assertEquals(data.title, "title");
});

Deno.test("testSolutionData() creates a started test solution", () => {
  const data = testSolutionData();
  assertEquals(data.status, "started");
  assertEquals(data.last_iterated_at, null);
  assertEquals(data.completed_at, null);
  assertEquals(data.published_at, null);
});

Deno.test("testSolutionData() can create an iterated test solution", () => {
  const data = testSolutionData({ status: "iterated" });
  assertEquals(data.status, "iterated");
  assertGreater(data.num_iterations, 0);
  assertExists(data.last_iterated_at);
  assertEquals(data.completed_at, null);
  assertEquals(data.published_at, null);
});

Deno.test("testSolutionData() can create a completed test solution", () => {
  const data = testSolutionData({ status: "completed" });
  assertEquals(data.status, "completed");
  assertExists(data.last_iterated_at);
  assertExists(data.completed_at);
  assertEquals(data.published_at, null);
});

Deno.test("testSolutionData() can create a published test solution", () => {
  const data = testSolutionData({ status: "published" });
  assertEquals(data.status, "published");
  assertExists(data.last_iterated_at);
  assertExists(data.completed_at);
  assertExists(data.public_url);
  assertExists(data.published_at);
});

Deno.test("testSubmissionData() creates a test submission", () => {
  const data = testSubmissionData({ tests_status: "failed" });
  assertEquals(data.tests_status, "failed");
});

Deno.test("testTestRunData() creates a test test run", () => {
  const data = testTestRunData({ status: "fail" });
  assertEquals(data.status, "fail");
});

Deno.test("testTestResultData() creates a test test result", () => {
  const data = testTestResultData({ status: "fail" });
  assertEquals(data.status, "fail");
});

Deno.test("testCompletionData() creates a test completion", () => {
  const unlocked = [testExerciseData({ slug: "exercise" })];
  const data = testCompletionData({ unlocked_exercises: unlocked });
  assertEquals(data.unlocked_exercises, unlocked);
});

Deno.test("testConceptProgressionData() creates a test concept progression", () => {
  const data = testConceptProgressionData({ slug: "concept" });
  assertEquals(data.slug, "concept");
  assertEquals(data.name, "Concept");
});

Deno.test("testIterationData() creates a test iteration", () => {
  const data = testIterationData({ status: "analyzing" });
  assertEquals(data.status, "analyzing");
});

Deno.test("testFilesData() creates a test files", () => {
  const data = testFilesData({ test: ["test"] });
  assertEquals(data.test, ["test"]);
});

Deno.test("testFileContent() creates a test file content", () => {
  const data = testFileContent({ content: "content" });
  assertEquals(data.content, "content");
});
