// Structural checks of `challenges/plans.json` (used by scripts/check.ts).
import type { Plan } from "@/challenges/types";
import { isRecord } from "@/lang/record";
import { isLocalized } from "./challenge";

export type PlansResult = { plans: Plan[] | null; problems: string[] };

/** Validates the plans file against the ids of the challenge files on disk. */
export function checkPlans(
  json: unknown,
  knownIds: ReadonlySet<string>,
  opts: { requireJa?: boolean } = {},
): PlansResult {
  const requireJa = opts.requireJa ?? false;
  if (!Array.isArray(json)) return { plans: null, problems: ["plans.json must be an array"] };
  const problems: string[] = [];
  const planIds = new Set<string>();
  /** Challenge id → index and label of the plan that first listed it. */
  const owners = new Map<string, { index: number; label: string }>();

  json.forEach((plan, p) => {
    if (!isRecord(plan)) {
      problems.push(`plans[${p}] must be an object`);
      return;
    }
    const label = typeof plan.id === "string" ? `plan "${plan.id}"` : `plans[${p}]`;
    if (typeof plan.id !== "string") problems.push(`${label} needs a string id`);
    else if (planIds.has(plan.id)) problems.push(`${label} is listed twice`);
    else planIds.add(plan.id);
    if (!isLocalized(plan.title, requireJa)) problems.push(`${label}: title must be { en, ja? }`);
    if (!isLocalized(plan.description, requireJa))
      problems.push(`${label}: description must be { en, ja? }`);

    if (!Array.isArray(plan.problems)) {
      problems.push(`${label}: problems must be an array`);
      return;
    }
    if (plan.problems.length === 0) problems.push(`${label} has no problems`);
    const seen = new Set<string>();
    plan.problems.forEach((id, i) => {
      if (typeof id !== "string") {
        problems.push(`${label}: problems[${i}] must be a challenge id`);
        return;
      }
      if (!knownIds.has(id)) problems.push(`${label}: unknown challenge "${id}"`);
      if (seen.has(id)) problems.push(`${label}: "${id}" is listed twice`);
      seen.add(id);
      const other = owners.get(id);
      if (other !== undefined && other.index !== p)
        problems.push(`"${id}" is in ${other.label} and ${label}`);
      owners.set(id, { index: p, label });
    });
  });

  return { plans: problems.length === 0 ? (json as Plan[]) : null, problems };
}
