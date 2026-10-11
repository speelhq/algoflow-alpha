// The number literal of the block language: the digits Python takes, with no sign, no `_`, and
// no other base. A leaf module: the parser reads its tokens with it, and the `num` block checks
// a stored literal with it, which the block cannot do through the parser (it imports the blocks).
import { fitsInt } from "@/lang/data";

/** A number literal at the start of a text: digits, a fraction, an exponent. */
export const NUMBER = /^(?:\d+\.\d*(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\.\d+(?:[eE][+-]?\d+)?|\d+)/;

/** Python rejects `0777`; `0` and `00` are fine. */
const LEADING_ZERO = /^0+\d*[1-9]/;

export type NumberLiteral = { value: number; float: boolean };

/**
 * What a literal written `raw` is: a float when it has `.`, `e`, or `E`, else an int. Undefined
 * when `raw` is no literal Python takes, an int outside the int range, or a float beyond the
 * largest one (stored JSON has no infinity).
 */
export function numberLiteral(raw: string): NumberLiteral | undefined {
  if (NUMBER.exec(raw)?.[0] !== raw) return undefined;
  const float = /[.eE]/.test(raw);
  const value = Number(raw);
  if (float) return Number.isFinite(value) ? { value, float } : undefined;
  return LEADING_ZERO.test(raw) || !fitsInt(value) ? undefined : { value, float };
}
