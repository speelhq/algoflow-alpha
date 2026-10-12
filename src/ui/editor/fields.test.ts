// A field of the editor's sentence is named by the template's words before it, else by
// the block's label.
import { describe, expect, it } from "vitest";
import { nodeText } from "@/i18n/t";
import { ast, program } from "@/nodes/testing";
import { fieldLabel } from "./fields";

const { assign, print, for_, num, v, exprStmt } = ast;

describe("fieldLabel", () => {
  it("names a field by the words before it, and one the sentence starts with by the label", () => {
    const set = assign("total", num(1));
    const p = program([assign("total", num(0)), set]);
    expect(fieldLabel(set, p, "target")).toBe("set");
    expect(fieldLabel(set, p, "value")).toBe("to");
    // The first assignment is written in its create form.
    expect(fieldLabel(set, program([set]), "value")).toBe("and set it to");
    const shown = print(v("total"));
    expect(fieldLabel(shown, program([shown]), "args")).toBe("print");
    const loop = for_("i", num(0), num(3), []);
    expect(fieldLabel(loop, program([loop]), "stop")).toBe("up to");
    const call = exprStmt(ast.call("max", v("a"), num(1)));
    expect(fieldLabel(call, program([call]), "expr")).toBe(nodeText("expr", "label"));
  });
});
