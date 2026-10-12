import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_CODES } from "@/lang/types";
import { PARSE_CODES } from "@/python/parse";
import { RUNTIME_CODES } from "@/runtime/types";
import en from "./en.json";
import { flatten } from "./flatten";

describe("error messages", () => {
  const catalog = flatten(en);

  it.each([...new Set([...DIAGNOSTIC_CODES, ...RUNTIME_CODES, ...PARSE_CODES])])(
    "%s has error.<CODE> in en.json",
    (code) => {
      expect(catalog[`error.${code}`]).toEqual(expect.any(String));
    },
  );
});
