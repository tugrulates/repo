/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// deno-lint-ignore-file prefer-ascii -- user facing strings

import type { Exercise, Profile, Track } from "./exercism.ts";

/** CLI help. */
export const help = {
  app: {
    description: "Manage Exercism tracks and exercise solutions.",
    summary: `manage exercism solutions`,
  },
  profile: {
    description: "Show profile information.",
    summary: "show profile",
  },
  tracks: {
    description: "Find tracks matching given filters.",
    summary: "list tracks",
  },
  track: (track: Track) => ({
    description: `Work on ${track.title} exercises.`,
    summary: `manage ${track.slug} exercises`,
  }),
  exercise: (exercise: Exercise) => ({
    description:
      `Work on the ${exercise.title} exercise of ${exercise.track.title} track.`,
    summary: `manage ${exercise.slug} exercise`,
  }),
  exercises: {
    start: {
      description: "Start exercises.",
      summary: "start exercise",
    },
    code: {
      description: "Open solution files on VSCode.",
      summary: "open solution code on IDE",
    },
    format: {
      description:
        "Format solution files with the code formatters of the track.",
      summary: "format solution",
    },
    lint: {
      description: "Check solution files with the linter(s) of the track.",
      summary: "lint solution",
    },
    test: {
      description: "Run unittests locally with the framework of the runner.",
      summary: "run unittests",
    },
    diff: {
      description: "Compare solution files to latest submitted iteration.",
      summary: "compare solution",
    },
    download: {
      description: "Download solution files from last submitted iteration.",
      summary: "download solution",
    },
    submit: {
      description: "Submit solution files to Exercism.",
      summary: "submit solution",
    },
    complete: {
      description: "Complete exercise, submitting if necessary.",
      summary: "complete exercise",
    },
    publish: {
      description: "Publish solution, submitting if necessary.",
      summary: "publish solution",
    },
    update: {
      description: "Update solution ot the latest version of the exercise.",
      summary: "update solution",
    },
    data: {
      description: "Dump internal data.",
      summary: "dump internal data",
    },
  },
  open: {
    profile: {
      description: "Open profile on the Exercism website.",
      summary: "Open profile on browser",
    },
    track: {
      description: "Open tracks on the Exercism website.",
      summary: "Open track on browser",
    },
    exercise: {
      description: "Open exercises on the Exercism website.",
      summary: "Open exercise on browser",
    },
  },
  options: {
    quiet: `enable quiet mode`,
    verbose: `enable verbose mode`,
    json: `dump internal data as JSON`,
    sync: `invalidate cache and sync data from Exercism`,
    open: `open related Exercism pages on browser`,
    workspace: `Directory containing Exercism solutions`,
    endpoint: `Exercism API endpoint`,
    retryTimeout: `timeout between retries in milliseconds`,
    token: `Exercism API token`,
    track: `only specific tracks`,
    exercise: `only specific exercises`,
    all: {
      tracks: `all tracks, joined or not`,
      exercises: `all exercises, locked or unlocked`,
    },
    locked: `only locked exercises`,
    easy: `only easy exercises`,
    medium: `only medium exercises`,
    hard: `only hard exercises`,
    new: `only new exercises`,
    started: `only started but incomplete exercises`,
    completed: `only completed exercises`,
    passing: `only exercises with passing iterations`,
    failing: `only exercises with failing iterations`,
    published: `only exercises with published last iteration`,
    draft: `only exercises with an unpublished last iteration`,
    feedback: `only exercises with automated feedback`,
    outdated: `only exercises on previous versions`,
    starred: `only exercises with starred solutions`,
    commented: `only exercises with commented solutions`,
    code: {
      check: `open failing exercises on IDE`,
      diff: `open differing files on IDE`,
    },
    force: {
      download: `force download, overwriting existing files`,
      submit: `force submit, skipping format, lint, and test checks`,
    },
    complete: `complete solution if all tests are passing`,
    publish: `publish solution if all tests are passing`,
  },
} as const;

/** User facing messages. */
export const messages: {
  app: {
    token: (url: string) => {
      prompt: string;
      missing: string;
      invalid: string;
    };
    found: (count: number) => {
      exercises: string;
      tracks: string;
    };
    invalidSlug: (slug: string) => string;
    error: (error: Error) => string;
  };
  track: (slug: string) => {
    notFound: string;
    notJoined: string;
  };
  exercise: (slug: string) => {
    notFound: string;
    notStarted: string;
    unlocked: string;
    start: {
      progress: string;
      success: string;
      skip: string;
      failure: string;
    };
    setup: {
      failure: string;
    };
    code: {
      progress: string;
    };
    format: {
      progress: string;
      success: string;
      failure: string;
    };
    lint: {
      progress: string;
      success: string;
      failure: string;
    };
    test: {
      progress: string;
      waiting: string;
      success: string;
      notQueued: string;
      noTestRun: string;
      timeout: string;
      testFailed: (test: { name: string; message: string }) => string;
      failure: string;
    };
    diff: {
      progress: string;
      notChanged: string;
      changed: string;
    };
    download: {
      progress: string;
      success: string;
      partialSuccess: string;
      skip: string;
      failure: string;
    };
    submit: {
      progress: string;
      success: string;
      clearing: string;
      uploading: string;
      skip: string;
      failure: string;
    };
    createIteration: {
      progress: string;
      success: string;
      failure: string;
    };
    complete: {
      progress: string;
      success: string;
      skip: string;
      failure: string;
    };
    publish: {
      progress: string;
      success: string;
      skip: string;
      failure: string;
    };
    publishIterations: {
      progress: string;
      success: string;
      skip: string;
      failure: string;
    };
    update: {
      progress: string;
      success: string;
      successWithFailedTests: string;
      skip: string;
      failure: string;
    };
  };
  file: (file: string) => {
    skip: string;
    notChanged: string;
    changed: string;
    add: string;
    delete: string;
    rename: string;
    modify: string;
    docgen: string;
    prompt: {
      overwrite: string;
    };
  };
  request: {
    made: (
      request: { method: string; url: string },
      response: { status: number; statusText: string },
    ) => string;
    error: (error: { message: string; type: string }) => string;
    tooManyRequests: string;
  };
} = {
  app: {
    token: (url: string): {
      prompt: string;
      missing: string;
      invalid: string;
    } => ({
      prompt: `🔑 Enter your Exercism API key (found at ${url}):`,
      missing: `❌ Exercism API token not provided.`,
      invalid: `❌ Invalid Exercism API token.`,
    }),
    found: (count: number): {
      exercises: string;
      tracks: string;
    } => ({
      exercises: `📝 Found ${count.toString()} exercises.`,
      tracks: `📝 Found ${count.toString()} tracks.`,
    }),
    invalidSlug: (slug: string): string => `Invalid slug ${slug}.`,
    error: (error: Error): string => `❌ ${error.name}: ${error.message}`,
  },
  track: (slug: string): {
    notFound: string;
    notJoined: string;
  } => ({
    notFound: `❌ Track ${slug} is not found.`,
    notJoined: `❌ Track ${slug} is not joined.`,
  }),
  exercise: (slug: string) => ({
    notFound: `❌ Exercise ${slug} not found.`,
    notStarted: `❌ Exercise ${slug} is not started.`,
    unlocked: `✨ Unlocked ${slug}.`,
    start: {
      progress: `⏳ Starting ${slug}.`,
      success: `💻 Started ${slug}.`,
      skip: `👀 Already started ${slug}.`,
      failure: `❌ Failed to start ${slug}.`,
    },
    setup: {
      failure: `❌ Failed to setup ${slug}.`,
    },
    code: {
      progress: `💻 Opening ${slug} on IDE.`,
    },
    format: {
      progress: `⌛ Formatting ${slug}.`,
      success: `✅ Formatted ${slug}.`,
      failure: `❌ Failed to format ${slug}.`,
    },
    lint: {
      progress: `⌛ Linting ${slug}.`,
      success: `✅ Linter for ${slug} passed.`,
      failure: `❌ Linter for ${slug} failed.`,
    },
    test: {
      progress: `⌛ Testing ${slug}.`,
      waiting: `🧪 Waiting test results for ${slug}.`,
      success: `✅ All tests passed for ${slug}.`,
      notQueued:
        `⚠️  Test run not queued for ${slug}. Creating iteration without tests.`,
      noTestRun: `❌ No test run for ${slug}.`,
      timeout: `❌ Timeout on ${slug} tests.`,
      testFailed: (test: { name: string; message: string }) =>
        `❌ Test failed: ${test.name}\n${test.message}`,
      failure: `❌ Tests for ${slug} failed.`,
    },
    diff: {
      progress: `⌛ Comparing ${slug} to submitted version.`,
      notChanged: `✅ No changes found in ${slug}.`,
      changed: `⚠️  Changes found in ${slug}.`,
    },
    download: {
      progress: `⌛ Downloading ${slug}.`,
      success: `✅ Downloaded ${slug}.`,
      partialSuccess: `✳️  Downloaded ${slug}, but kept some files.`,
      skip: `👀 Already downloaded ${slug}.`,
      failure: `❌ Failed to download files.`,
    },
    submit: {
      progress: `⏳ Submitting solution for ${slug}.`,
      success: `✅ Submitted solution for ${slug}.`,
      clearing: `🗑️  Clearing submission for ${slug}.`,
      uploading: `📦 Uploading files for ${slug}.`,
      skip: `👀 Already submitted solution for ${slug}.`,
      failure: `❌ Failed to submit ${slug}.`,
    },
    createIteration: {
      progress: `⏳ Creating iteration for ${slug}.`,
      success: `✅ Created iteration for ${slug}.`,
      failure: `❌ Failed to create iteration for ${slug}.`,
    },
    complete: {
      progress: `⏳ Completing ${slug}.`,
      success: `🎉 Completed ${slug}`,
      skip: `👀 Already completed ${slug}.`,
      failure: `❌ Failed to complete ${slug}.`,
    },
    publish: {
      progress: `⏳ Publishing solution for ${slug}.`,
      success: `📣 Published ${slug}.`,
      skip: `👀 Already published solution for ${slug}.`,
      failure: `❌ Failed to publish solution for ${slug}.`,
    },
    publishIterations: {
      progress: `⏳ Publishing all iterations for ${slug}.`,
      success: `📣 Published all iterations for ${slug}.`,
      skip: `👀 Already published all iterations for ${slug}.`,
      failure: `❌ Failed to publish all iterations for ${slug}.`,
    },
    update: {
      progress: `⏳ Updating ${slug}.`,
      success: `✅ Updated ${slug}.`,
      successWithFailedTests: `✳️  Updated ${slug}. Tests are now failing.`,
      skip: `👀 Already at the last version of ${slug}.`,
      failure: `❌ Failed to update ${slug}.`,
    },
  }),
  file: (file: string): {
    skip: string;
    notChanged: string;
    changed: string;
    add: string;
    delete: string;
    rename: string;
    modify: string;
    docgen: string;
    prompt: {
      overwrite: string;
    };
  } => ({
    skip: `📦 Skipping ${file}.`,
    notChanged: `🔎 No changes found in ${file}.`,
    changed: `🔍 Changes found in ${file}.`,
    add: `🆕 Adding ${file} to the repository.`,
    delete: `🗑️  Deleting ${file} from the repository.`,
    rename: `🏷  Renaming ${file} in the repository.`,
    modify: `📝 Updating ${file} in the repository.`,
    docgen: `📝 Adding docstring to ${file}.`,
    prompt: {
      overwrite: `📦 Overwrite existing file ${file}?`,
    },
  }),
  request: {
    made: (
      request: { method: string; url: string },
      response: { status: number; statusText: string },
    ): string =>
      `🌍 API request made (` +
      `${request.method} ${request.url} ` +
      `${response.status.toString()} ${response.statusText}).`,
    error: (error: { message: string; type: string }): string =>
      `${error.message} [${error.type}].`,
    tooManyRequests: `❌ Too many requests. Please try again later.`,
  },
} as const;

/** Display text. */
export const display = {
  profile: (profile: Profile) => ({
    handle: `👤 ${profile.handle}`,
    reputation: `🎖️ ${profile.reputation.toString()}`,
  }),
  track: (track: Track) => ({
    completed: `🚀 ${track.slug}`,
    joined: `🧩 ${track.slug}`,
    notJoined: `🔒 ${track.slug}`,
    numExercises: `${track.numExercises} exercises`,
    numCompleted: `${track.numCompleted}/${track.numExercises} exercises`,
  }),
  exercise: (exercise: Exercise) => ({
    completed: `✅ ${exercise.slug}`,
    noTestResults: `✳️  ${exercise.slug} [no test results]`,
    hasFeedback: `⚠️  ${exercise.slug}`,
    draft: `📜 ${exercise.slug}`,
    outdated: `🕰️  ${exercise.slug}`,
    started: `💻 ${exercise.slug}`,
    failing: `❌ ${exercise.slug}`,
    new: `✨ ${exercise.slug}`,
    locked: `🔒 ${exercise.slug}`,
    notJoined: `🔮 ${exercise.slug}`,
    feedback: ((exercise.solution?.hasAutomatedFeedback) ?? false)
      ? `🤖`
      : ((exercise.solution?.hasHumanFeedback) ?? false)
      ? "💡"
      : "",
    tests: (exercise.solution?.passing) === false ? "🧪" : "",
    social: "⭐".repeat((exercise.solution?.stars) ?? 0) +
      "💬".repeat((exercise.solution?.comments) ?? 0),
  }),
  notification: "🔔",
};

/** Generated code. */
export const generated = {
  toolchain: {
    docComment: (exercise: Exercise) =>
      `Solution to ${exercise.title} in ${exercise.track.title} on Exercism.`,
  },
};
