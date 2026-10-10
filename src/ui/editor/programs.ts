// What `⋯`, the Accepted view, and the Playground do to a whole program: `Open in
// Playground` (each input becoming an assignment at the top of `main`), Export, and Import.
import { migrate } from "@/lang/migrate";
import type { Expr, Input, Program, Stmt } from "@/lang/types";
import { getNode } from "@/nodes/registry";
import { dataToPython } from "@/python/emit";
import { isParseError, parse } from "@/python/parse";
import { createPlaygroundProgram } from "@/store/program";
import { navigate } from "@/ui/app/route";

/** An input as the emitter writes it: `name = <value>`. */
function inputAssignment(input: Input): Stmt | undefined {
  const value = parse(dataToPython(input.value));
  if (isParseError(value)) return undefined;
  const assign = getNode("assign").create() as Extract<Stmt, { kind: "assign" }>;
  return { ...assign, target: { kind: "var", name: input.name }, value: value as Expr };
}

/** The Playground program `Open in Playground` makes of `program`, titled `title`. */
export function playgroundCopy(program: Program, title: string): Program {
  const assignments = program.inputs.flatMap((input) => inputAssignment(input) ?? []);
  const copy = structuredClone(program);
  return { ...copy, title, inputs: [], main: [...assignments, ...copy.main] };
}

/** `Open in Playground`: stores the copy as a new Playground program and opens it. */
export function openInPlayground(program: Program, title: string): void {
  const id = createPlaygroundProgram(playgroundCopy(program, title));
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
