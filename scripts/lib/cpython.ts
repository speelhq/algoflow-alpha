// Run emitted Python under CPython with the random shim and a JSON epilogue.
// The program executes in its own namespace so harness names never collide with
// the learner's variables; `print` is captured per call to match `stdout()`.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Data, Id } from "@/lang/types";
import { NODES } from "@/nodes/registry";

export const PYTHON = process.env.PYTHON ?? "python3";

/** Python functions of the random module that replay `draws()`: derived from the registry. */
export function randomShims(): string[] {
  const names: string[] = [];
  for (const def of NODES.values()) {
    if (def.imports !== "random") continue;
    for (const alias of def.aliases ?? []) {
      if (alias.startsWith("random.")) names.push(alias.slice("random.".length));
    }
  }
  return names;
}

const HARNESS = `import sys, json, builtins
import random as _random
_draws = iter(__DRAWS__)
def _draw(*args, **kwargs):
    try:
        return next(_draws)
    except StopIteration:
        raise RuntimeError("draws exhausted")
for _name in __SHIMS__:
    setattr(_random, _name, _draw)
_lines = []
def _print(*args, sep=" ", end="\\n", file=None, flush=False):
    _lines.append(sep.join(str(a) for a in args))
builtins.print = _print
_ns = {"__name__": "__main__"}
exec(compile(__CODE__, "solution.py", "exec"), _ns)
_ids = {}
_open = set()
def _to_data(v):
    if isinstance(v, bool) or isinstance(v, int) or isinstance(v, str) or v is None:
        return v
    if isinstance(v, float):
        if v == v and v not in (float("inf"), float("-inf")) and v == int(v):
            return {"$float": v}
        return v
    if isinstance(v, list):
        return [_to_data(x) for x in v]
    if isinstance(v, dict):
        return {("$int:%d" % k) if isinstance(k, int) and not isinstance(k, bool) else str(k): _to_data(x) for k, x in v.items()}
    if id(v) not in _ids:
        _ids[id(v)] = len(_ids) + 1
    d = {"$cls": type(v).__name__, "$id": _ids[id(v)]}
    if id(v) in _open:
        return d
    _open.add(id(v))
    for k, x in vars(v).items():
        d[k] = _to_data(x)
    _open.discard(id(v))
    return d
_vars = {name: _to_data(_ns[name]) for name in __NAMES__ if name in _ns}
sys.stdout.write(json.dumps({"stdout": _lines, "vars": _vars}) + "\\n")
`;

export function buildScript(code: string, draws: number[], names: Id[]): string {
  return HARNESS.replace("__DRAWS__", JSON.stringify(draws))
    .replace("__SHIMS__", JSON.stringify(randomShims()))
    .replace("__CODE__", JSON.stringify(code))
    .replace("__NAMES__", JSON.stringify(names));
}

export type PythonResult = { stdout: string[]; vars: Record<Id, Data> } | { error: string };

export function runPython(code: string, draws: number[], names: Id[]): PythonResult {
  const dir = mkdtempSync(join(tmpdir(), "algoflow-check-"));
  const file = join(dir, "harness.py");
  try {
    writeFileSync(file, buildScript(code, draws, names));
    const result = spawnSync(PYTHON, [file], { encoding: "utf8", timeout: 30_000 });
    if (result.error) return { error: `${PYTHON}: ${result.error.message}` };
    if (result.status !== 0) {
      return { error: result.stderr.trim().split("\n").at(-1) ?? `exit ${result.status}` };
    }
    const last = result.stdout.trim().split("\n").at(-1) ?? "";
    try {
      return JSON.parse(last) as { stdout: string[]; vars: Record<Id, Data> };
    } catch {
      return { error: `unreadable epilogue: ${last.slice(0, 120)}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
