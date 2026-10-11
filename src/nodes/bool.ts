// The `bool` block
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const bool = defineExpr<"bool">({
  key: "bool",
  category: "basic",
  slots: [],
  create: () => ({ id: newId(), kind: "bool", value: true }),
  fieldsError: (fields) =>
    typeof fields.value === "boolean"
      ? undefined
      : { field: "value", message: "expected true or false" },
  zeroLike: () => ({ id: newId(), kind: "bool", value: false }),
  *run(node) {
    return { t: "bool", v: node.value };
  },
  python: (node) => (node.value ? "True" : "False"),
  form: (node) => (node.value ? "" : "False"), // `templateFalse`
  kind: () => "truefalse",
  menu: [
    { name: "true", group: "values", preset: { value: true } },
    { name: "false", group: "values", preset: { value: false } },
  ],
});
