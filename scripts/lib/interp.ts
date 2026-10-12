// Runs a program to completion in the interpreter and reports the result the judge compares.
import type { Data, Id, Program } from "@/lang/types";
import { finish, outcomeOf, type Outcome } from "@/runtime/outcome";
import { run } from "@/runtime/run";

export function execute(program: Program, inputs: Record<Id, Data>, seed: number): Outcome {
  const runner = run(program, inputs, seed);
  return outcomeOf(runner, finish(runner));
}
