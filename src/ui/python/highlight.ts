// The Python tab colours keywords, strings, numbers, and comments, and nothing else.
// One emitted line at a time: the emitter writes no string that spans lines.
import { PYTHON_KEYWORDS } from "@/lang/types";

export type Token = { kind: "keyword" | "string" | "number" | "comment" | "text"; text: string };

const TOKEN =
  /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b|\.\d+(?:[eE][+-]?\d+)?\b)|([A-Za-z_]\w*)/g;

export function highlight(line: string): Token[] {
  const tokens: Token[] = [];
  let plain = "";
  let at = 0;
  const flush = () => {
    if (plain !== "") tokens.push({ kind: "text", text: plain });
    plain = "";
  };
  for (const match of line.matchAll(TOKEN)) {
    plain += line.slice(at, match.index);
    at = match.index + match[0].length;
    const [text, comment, string, number, word] = match;
    const kind =
      comment !== undefined
        ? "comment"
        : string !== undefined
          ? "string"
          : number !== undefined
            ? "number"
            : word !== undefined && PYTHON_KEYWORDS.has(word)
              ? "keyword"
              : "text";
    if (kind === "text") {
      plain += text;
      continue;
    }
    flush();
    tokens.push({ kind, text });
  }
  plain += line.slice(at);
  flush();
  return tokens;
}
