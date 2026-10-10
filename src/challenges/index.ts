// The browser bundles `challenges/*.json` at build time. The list follows the plans: the
// members of each plan in its order, the plans in theirs.
import { PLANS } from "./plans";
import type { Challenge } from "./types";

const files = import.meta.glob<Challenge>(
  ["../../challenges/*.json", "!../../challenges/plans.json"],
  { eager: true, import: "default" },
);
const byId = new Map(Object.values(files).map((challenge) => [challenge.id, challenge]));

export const CHALLENGES: readonly Challenge[] = PLANS.flatMap((plan) =>
  plan.problems.map((id) => {
    const challenge = byId.get(id);
    if (!challenge) throw new Error(`plan "${plan.id}" lists "${id}", which has no file`);
    return challenge;
  }),
);

export function getChallenge(id: string | undefined): Challenge | undefined {
  return id === undefined ? undefined : CHALLENGES.find((challenge) => challenge.id === id);
}

export { PLANS, planOf } from "./plans";
export type { Challenge, Difficulty, Localized, Plan, Test, Topic } from "./types";
