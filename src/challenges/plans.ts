// The study plans, bundled at build time by a static import so that
// `index.ts` can leave `plans.json` out of its challenge glob.
import plans from "../../challenges/plans.json";
import type { Plan } from "./types";

export const PLANS: readonly Plan[] = plans;

const members = new Map<string, Plan>();
for (const plan of PLANS) for (const id of plan.problems) members.set(id, plan);

/** The plan a challenge belongs to; every challenge is in exactly one. */
export function planOf(id: string): Plan {
  const plan = members.get(id);
  if (!plan) throw new Error(`challenge "${id}" is in no plan`);
  return plan;
}
