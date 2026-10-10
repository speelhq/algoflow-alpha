// The challenge and plan schemas. A leaf module: scripts run with tsx
// import it, so it must not import `index.ts` (which uses `import.meta.glob`).
import type { Data, Id, Input, Program } from "@/lang/types";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** The fixed topic list. */
export const TOPICS = [
  "output",
  "variables",
  "loops",
  "conditions",
  "lists",
  "searching",
  "sorting",
  "recursion",
  "dictionaries",
  "classes",
] as const;
export type Topic = (typeof TOPICS)[number];

export type Localized = { en: string; ja?: string };
export type Test = {
  /** A test is shown by these values; it has no name. */
  inputs: Record<Id, Data>;
  /** A boundary case; every challenge has at least one. */
  edge?: boolean;
  seed?: number;
  expect: { variables?: Record<Id, Data>; stdout?: string[] };
};
export type Challenge = {
  id: string;
  title: Localized;
  difficulty: Difficulty;
  topics: Topic[];
  description: Localized;
  inputs: Input[];
  tests: Test[];
  hints: Localized[];
  /** One sentence shown as `What you used`. */
  takeaway?: Localized;
  /** The learner module the challenge's functions and classes belong to. */
  module?: Id;
  /** Names the submission must define itself, in the program or a learner module. */
  defines?: Id[];
  solution: Program;
};

/** One study plan of `challenges/plans.json`. */
export type Plan = {
  id: string;
  title: Localized;
  description: Localized;
  problems: string[];
};
