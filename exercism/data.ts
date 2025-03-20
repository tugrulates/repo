// deno-lint-ignore-file camelcase -- API data uses snake_case

import type { CacheGetOptions } from "./cache.ts";

export abstract class ApiElement<T> {
  async sync(): Promise<void> {
    await this.data({ skipCache: true });
  }

  abstract url(): string | Promise<string>;
  abstract data(options: CacheGetOptions): Promise<T | null>;
}

export interface UserData {
  handle?: string;
}

export interface ReputationData {
  total_reputation?: number;
}

export type ProfileData = UserData & ReputationData;

export interface TrackData {
  slug?: string;
  title?: string;
  course?: boolean;
  num_concepts?: number;
  num_exercises?: number;
  web_url?: string;
  icon_url?: string;
  tags?: string[];
  last_touched_at?: string;
  is_new?: boolean;
  links?: {
    self?: string;
    exercises?: string;
    concepts?: string;
  };
  is_joined?: boolean;
  num_learned_concepts?: number;
  num_completed_exercises?: number;
  num_solutions?: number;
  has_notifications?: boolean;
}

export interface ExerciseData {
  slug?: string;
  title?: string;
  difficulty?: "easy" | "medium" | "hard";
  blurb?: string;
  is_unlocked?: boolean;
  is_recommended?: boolean;
  links?: {
    self?: string;
  };
  solution_uuid?: string | undefined;
}

export interface SolutionData {
  uuid?: string;
  private_url?: string;
  public_url?: string;
  status?: "started" | "iterated" | "completed" | "published";
  mentoring_status?: "none" | "requested" | "in_progress" | "finished";
  published_iteration_head_tests_status?:
    | "not_queued"
    | "queued"
    | "passed"
    | "failed"
    | "errored"
    | "exceptioned"
    | "cancelled";
  has_notifications?: boolean;
  num_views?: number;
  num_stars?: number;
  num_comments?: number;
  num_iterations?: number;
  num_loc?: number;
  is_out_of_date?: boolean;
  published_at?: string;
  completed_at?: string;
  updated_at?: string;
  last_iterated_at?: string;
  exercise?: {
    slug?: string;
    title?: string;
    icon_url?: string;
  };
  track?: {
    slug?: string;
    title?: string;
    icon_url?: string;
  };
  files?: FilesData;
}

export type SubmissionTestStatus =
  | "not_queued"
  | "queued"
  | "passed"
  | "failed"
  | "errored"
  | "exceptioned"
  | "cancelled";

export interface SubmissionData {
  uuid?: string;
  tests_status?: SubmissionTestStatus;
}

export type TestRunStatus =
  | "pass"
  | "fail"
  | "error"
  | "ops_error"
  | "queued"
  | "timeout"
  | "cancelled";

export interface TestRunData {
  uuid?: string;
  status?: TestRunStatus;
  message?: string;
  tests?: [
    {
      name?: string;
      status?: TestRunStatus;
      message?: string;
    },
  ];
}

export interface CompletionData {
  track?: {
    slug?: string;
    num_completed_exercises?: number;
  };
  exercise?: {
    slug?: string;
  };
  unlocked_exercises?: {
    slug?: string;
    is_unlocked?: true;
  }[];
}

export interface FilesData {
  solution: string[];
  test: string[];
  editor: string[];
  example: string[];
}

export interface FileContent {
  filename?: string;
  type?: "solution" | "readonly";
  content?: string;
}

export interface IterationData {
  uuid?: string;
  idx?: number;
  status?:
    | "untested"
    | "testing"
    | "tests_failed"
    | "analyzing"
    | "essential_automated_feedback"
    | "actionable_automated_feedback"
    | "celebratory_automated_feedback"
    | "non_actionable_automated_feedback"
    | "no_automated_feedback";
  num_essential_automated_comments?: number;
  num_actionable_automated_comments?: number;
  num_non_actionable_automated_comments?: number;
  num_celebratory_automated_comments?: number;
  submission_method?: "api" | "cli";
  created_at?: string;
  tests_status?: SubmissionTestStatus;
  is_published?: boolean;
  is_latest?: boolean;
  links?: {
    self?: string;
  };
}
