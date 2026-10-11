// The list under a name field: the names of the problem's expected variables under
// `This problem`, the program's other variables under `Variables`, each kept while one of its
// words begins with the text typed, and a typed name neither holds offered as a new variable.
import { declaredBy } from "@/lang/scope";
import { NAME_PATTERN, RESERVED, type Id, type Program } from "@/lang/types";
import { programStmts } from "@/lang/walk";
import { matchesName } from "./line";

/** Every variable name the program has: inputs, parameters, and assigned names, in program order. */
function programNames(program: Program): Id[] {
  const names = new Set<Id>(program.inputs.map((input) => input.name));
  for (const fn of program.functions) for (const param of fn.params) names.add(param);
  for (const { stmt } of programStmts(program)) {
    for (const { name } of declaredBy(stmt)) names.add(name);
  }
  return [...names];
}

export type NameRow = { kind: "name"; name: Id } | { kind: "new"; name: Id };
export type NameSection = { group: "problem" | "variables" | "new"; rows: NameRow[] };

/** The sections of the list for the text typed; `asked` are the problem's expected names. */
export function nameSections(program: Program, asked: readonly Id[], typed: string): NameSection[] {
  const problem = [...new Set(asked)];
  const others = programNames(program).filter((name) => !problem.includes(name));
  // A whole name comes first.
  const whole = (names: Id[]) =>
    names.toSorted((a, b) => Number(b === typed) - Number(a === typed));
  const sections: NameSection[] = [
    {
      group: "problem",
      rows: whole(problem.filter((n) => matchesName(n, typed))).map((name) => ({
        kind: "name",
        name,
      })),
    },
    {
      group: "variables",
      rows: whole(others.filter((n) => matchesName(n, typed))).map((name) => ({
        kind: "name",
        name,
      })),
    },
  ];
  const known = problem.includes(typed) || others.includes(typed);
  if (typed !== "" && !known && NAME_PATTERN.test(typed) && !RESERVED.has(typed)) {
    sections.push({ group: "new", rows: [{ kind: "new", name: typed }] });
  }
  return sections.filter((section) => section.rows.length > 0);
}

/** What a name field keeps of typed text: the characters a name may have, no digit first. */
export function nameChars(text: string): string {
  return text.replace(/[^a-z0-9_]/g, "").replace(/^[0-9]+/, "");
}
