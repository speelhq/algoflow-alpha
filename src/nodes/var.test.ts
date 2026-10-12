import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, runAll, withInputs } from "./testing";

const { v, num, for_, print } = ast;

describe("var (nodes.md)", () => {
  it("emits the name", () => {
    expect(unparse(ast.v("total"))).toBe("total");
  });

  it("reads the variable and emits no event", () => {
    expect(evalExpr(ast.v("n"), { n: 7 })).toMatchObject({ data: 7, events: [] });
  });

  it("a variable never assigned → E_UNDEFINED with its name", () => {
    const e = ast.v("ghost");
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_UNDEFINED", params: { name: "ghost" } },
    });
  });

  it("a loop variable read after a loop that ran no pass → E_UNDEFINED at run time", () => {
    const read = v("i");
    const made = withInputs({ n: 0 }, [for_("i", num(0), v("n"), []), print(read)]);
    expect(runAll(made.program, made.inputs).done).toMatchObject({
      type: "error",
      error: { nodeId: read.id, code: "E_UNDEFINED", params: { name: "i" } },
    });
  });
});
