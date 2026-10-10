// Structural checks of a challenge file (used by scripts/check.ts).
// The schema types live in src/challenges/types.ts.
import { DIFFICULTIES, TOPICS, type Challenge, type Localized } from "@/challenges/types";
import { migrate } from "@/lang/migrate";
import { isRecord } from "@/lang/record";
import { isValidName, validate } from "@/lang/validate";

export function isLocalized(value: unknown, requireJa: boolean): value is Localized {
  if (!isRecord(value) || typeof value.en !== "string") return false;
  if (requireJa && typeof value.ja !== "string") return false;
  return value.ja === undefined || typeof value.ja === "string";
}

function sameData(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The keys a challenge file may hold. */
const KEYS: ReadonlySet<string> = new Set([
  "id",
  "title",
  "difficulty",
  "topics",
  "description",
  "inputs",
  "tests",
  "hints",
  "takeaway",
  "module",
  "defines",
  "solution",
]);

export type SchemaResult = { challenge: Challenge | null; problems: string[] };

/** Validates one challenge file's JSON. `fileId` is the file name without `.json`. */
export function checkChallengeSchema(
  json: unknown,
  fileId: string,
  opts: { requireJa?: boolean } = {},
): SchemaResult {
  const problems: string[] = [];
  const requireJa = opts.requireJa ?? false;
  if (!isRecord(json)) return { challenge: null, problems: ["not an object"] };

  if (json.id !== fileId)
    problems.push(`id "${String(json.id)}" does not match the file name "${fileId}"`);
  for (const key of Object.keys(json)) if (!KEYS.has(key)) problems.push(`unknown key "${key}"`);
  if (!isLocalized(json.title, requireJa)) problems.push("title must be { en, ja? }");
  if (!DIFFICULTIES.some((d) => d === json.difficulty))
    problems.push(
      `difficulty "${String(json.difficulty)}" is not one of ${DIFFICULTIES.join(", ")}`,
    );
  if (!Array.isArray(json.topics) || json.topics.length === 0)
    problems.push("topics must be a non-empty array");
  else
    for (const topic of json.topics)
      if (!TOPICS.some((t) => t === topic))
        problems.push(`topic "${String(topic)}" is not one of ${TOPICS.join(", ")}`);
  if (!isLocalized(json.description, requireJa)) problems.push("description must be { en, ja? }");
  if (json.takeaway !== undefined && !isLocalized(json.takeaway, requireJa))
    problems.push("takeaway must be { en, ja? }");

  const inputs = Array.isArray(json.inputs) ? json.inputs : [];
  if (!Array.isArray(json.inputs)) problems.push("inputs must be an array");
  const inputNames: string[] = [];
  inputs.forEach((input, i) => {
    if (!isRecord(input) || typeof input.name !== "string" || !("value" in input)) {
      problems.push(`inputs[${i}] must be { name, value }`);
      return;
    }
    if (!isValidName(input.name))
      problems.push(`inputs[${i}] name "${input.name}" is not a valid name`);
    if (inputNames.includes(input.name))
      problems.push(`inputs[${i}] name "${input.name}" is duplicated`);
    inputNames.push(input.name);
  });

  const tests = Array.isArray(json.tests) ? json.tests : [];
  if (!Array.isArray(json.tests) || tests.length < 3)
    problems.push("tests must be an array of at least 3");
  let edge = false;
  tests.forEach((test, i) => {
    if (!isRecord(test)) return problems.push(`tests[${i}] must be an object`);
    if (test.edge !== undefined && typeof test.edge !== "boolean")
      problems.push(`tests[${i}].edge must be a boolean`);
    else if (test.edge === true) edge = true;
    if (!isRecord(test.inputs)) problems.push(`tests[${i}].inputs must be an object`);
    else {
      for (const name of inputNames)
        if (!(name in test.inputs)) problems.push(`tests[${i}].inputs is missing "${name}"`);
      for (const name of Object.keys(test.inputs))
        if (!inputNames.includes(name))
          problems.push(`tests[${i}].inputs has unknown input "${name}"`);
    }
    if (test.seed !== undefined && typeof test.seed !== "number")
      problems.push(`tests[${i}].seed must be a number`);
    if (
      !isRecord(test.expect) ||
      (!isRecord(test.expect.variables) && !Array.isArray(test.expect.stdout))
    ) {
      problems.push(`tests[${i}].expect needs variables and/or stdout`);
    }
  });
  if (tests.length > 0 && !edge) problems.push("no test has edge: true");

  const hints = Array.isArray(json.hints) ? json.hints : [];
  if (!Array.isArray(json.hints) || hints.length !== 3) problems.push("hints must be exactly 3");
  hints.forEach((hint, i) => {
    if (!isLocalized(hint, requireJa)) problems.push(`hints[${i}] must be { en, ja? }`);
  });

  try {
    const program = migrate(json.solution);
    if (!sameData(program.inputs, inputs)) problems.push("solution.inputs must equal inputs");
    if (program.challengeId !== undefined && program.challengeId !== fileId)
      problems.push(`solution.challengeId must be "${fileId}"`);
    for (const d of validate(program))
      problems.push(`solution: ${d.code} at ${d.nodeId} ${JSON.stringify(d.params)}`);
  } catch (error) {
    problems.push(`solution: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { challenge: problems.length === 0 ? (json as unknown as Challenge) : null, problems };
}
