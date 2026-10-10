// The chosen case of a program: the one home of the values its inputs take. A problem's
// program takes the values of its challenge's test at the case index; a program with no
// challenge declares no input and takes none.
import type { Data, Id, Program } from "@/lang/types";
import { getChallenge } from "./index";
import type { Test } from "./types";

const NONE: Readonly<Record<Id, Data>> = Object.freeze({});

/** The test at `caseIndex` of the program's challenge; undefined for a program with none. */
export function caseOf(program: Program, caseIndex: number): Test | undefined {
  return getChallenge(program.challengeId)?.tests[caseIndex];
}

/** The values of the program's inputs in the chosen case. */
export function caseInputs(program: Program, caseIndex: number): Readonly<Record<Id, Data>> {
  const test = caseOf(program, caseIndex);
  if (test) return test.inputs;
  if (program.inputs.length > 0) {
    throw new Error(`no case ${caseIndex} gives the inputs of "${program.title}"`);
  }
  return NONE;
}
