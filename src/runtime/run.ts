// The interpreter. Blocks own their semantics; this file
// owns frames, dispatch, counting, limits, and the Runner contract.
import { toValue } from "@/lang/data";
import type { Data, Expr, Heap, Id, NodeId, Program, Stmt, Value } from "@/lang/types";
import { getNode, keyOf } from "@/nodes/registry";
import type { ExprRunner, RunContext, Signal, StmtRunner } from "@/nodes/types";
import { RuntimeFailure } from "./errors";
import { createRandom } from "./random";
import type { Done, Event, Frame, Runner, RuntimeCode } from "./types";

export const STEP_LIMIT = 1_000_000;
export const CALL_DEPTH_LIMIT = 200;

export function run(program: Program, inputs: Record<Id, Data>, seed: number): Runner {
  const heap: Heap = new Map();
  const frames: Frame[] = [{ fn: "main", vars: new Map() }];
  const random = createRandom(seed);
  const stdout: string[] = [];
  const functions = new Map(program.functions.map((fn) => [fn.name, fn]));

  const top = (): Frame => {
    const frame = frames[frames.length - 1];
    if (!frame) throw new Error("no frame");
    return frame;
  };

  const ctx: RunContext = {
    program,
    heap,
    *eval(expr: Expr) {
      const def = getNode(keyOf(expr));
      return yield* (def.run as ExprRunner)(expr, ctx);
    },
    *exec(body: Stmt[]) {
      for (const stmt of body) {
        yield { type: "enter", nodeId: stmt.id };
        const def = getNode(keyOf(stmt));
        const signal: Signal = yield* (def.run as StmtRunner)(stmt, ctx);
        if (signal) return signal;
      }
      return undefined;
    },
    get(name, nodeId) {
      // A loop variable is visible after its loop yet unbound when the loop ran no iteration.
      const value = top().vars.get(name);
      if (value === undefined) return ctx.fail(nodeId, "E_UNDEFINED", { name });
      return value;
    },
    set(name, value) {
      top().vars.set(name, value);
    },
    *call(fn, args, nodeId) {
      const def = functions.get(fn);
      if (!def) throw new Error(`unknown function ${fn}`);
      if (def.params.length !== args.length) {
        ctx.fail(nodeId, "E_ARITY", { name: fn, expected: def.params.length, got: args.length });
      }
      // The stack holds at most CALL_DEPTH_LIMIT frames, `main` included.
      if (frames.length >= CALL_DEPTH_LIMIT) ctx.fail(nodeId, "E_RECURSION");
      const vars = new Map<Id, Value>();
      def.params.forEach((param, i) => vars.set(param, args[i] ?? { t: "none" }));
      frames.push({ fn, callNodeId: nodeId, vars });
      yield { type: "call", nodeId, fn, args };
      const signal = yield* ctx.exec(def.body);
      const value: Value = signal?.kind === "return" ? signal.value : { t: "none" };
      yield { type: "return", nodeId, fn, value };
      frames.pop();
      return value;
    },
    fail(nodeId: NodeId, code: RuntimeCode, params = {}) {
      throw new RuntimeFailure(nodeId, code, params);
    },
    random: {
      int: (a, b) => random.int(a, b),
      float: (a, b) => random.float(a, b),
    },
    print(line) {
      stdout.push(line);
    },
  };

  // Inputs are the first main-level variables, in declaration order.
  for (const input of program.inputs) {
    const data = Object.hasOwn(inputs, input.name) ? (inputs[input.name] ?? null) : input.value;
    top().vars.set(input.name, toValue(data, heap));
  }

  const main = ctx.exec(program.main);
  let steps = 0;
  let loops = 0;
  let lastNodeId: NodeId = program.main[0]?.id ?? "";
  let finished: Done | undefined;

  return {
    next() {
      if (finished) return finished;
      if (steps >= STEP_LIMIT) {
        finished = {
          type: "error",
          error: { nodeId: lastNodeId, code: "E_STEP_LIMIT", params: {} },
          steps,
        };
        return finished;
      }
      try {
        const result = main.next();
        if (result.done) {
          finished = { type: "done", steps, loops };
          return finished;
        }
        const event: Event = result.value;
        steps += 1;
        if (event.type === "loop") loops += 1;
        lastNodeId = event.nodeId;
        return event;
      } catch (error) {
        if (error instanceof RuntimeFailure) {
          finished = { type: "error", error: error.error, steps };
          return finished;
        }
        throw error;
      }
    },
    state: () => ({ frames, heap }),
    stdout: () => [...stdout],
    draws: () => random.draws(),
  };
}
