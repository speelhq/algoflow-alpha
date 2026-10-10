// What `⋯`, the Accepted view, and the Playground do to a whole program: `Open in
// Playground` (each input becoming an assignment of the chosen case's value at the top of
// `main`), Export, and Import.
import { caseInputs } from "@/challenges/cases";
import { inputValue } from "@/lang/data";
import { migrate } from "@/lang/migrate";
import type { Data, Expr, Id, Program, Stmt } from "@/lang/types";
import { getNode } from "@/nodes/registry";
import { dataToPython } from "@/python/emit";
import { isParseError, parse } from "@/python/parse";
import { createPlaygroundProgram, useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { navigate } from "@/ui/app/route";

/** An input as the emitter writes it: `name = <value>`. */
function inputAssignment(name: Id, data: Data): Stmt | undefined {
  const value = parse(dataToPython(data));
  if (isParseError(value)) return undefined;
  const assign = getNode("assign").create() as Extract<Stmt, { kind: "assign" }>;
  return { ...assign, target: { kind: "var", name }, value: value as Expr };
}

/** The Playground program `Open in Playground` makes of `program`, its inputs valued by `inputs`. */
export function playgroundCopy(
  program: Program,
  title: string,
  inputs: Readonly<Record<Id, Data>>,
): Program {
  const assignments = program.inputs.flatMap(
    ({ name }) => inputAssignment(name, inputValue(inputs, name)) ?? [],
  );
  const copy = structuredClone(program);
  return { ...copy, title, inputs: [], main: [...assignments, ...copy.main] };
}

/** `Open in Playground` on the open program and the chosen case: stores the copy and opens it. */
export function openInPlayground(title: string): void {
  const { program } = useProgram.getState();
  const inputs = caseInputs(program, useRun.getState().caseIndex);
  const id = createPlaygroundProgram(playgroundCopy(program, title, inputs));
  navigate({ page: "program", id });
}

/** The name Export gives the file: `<title>.algoflow.json`. */
export function exportName(title: string, untitled: string): string {
  const name = title.trim() || untitled;
  return `${name}.algoflow.json`;
}

/** Import: the program a file holds, or undefined when `migrate()` rejects it. */
export function importedProgram(text: string): Program | undefined {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return undefined;
  }
}
