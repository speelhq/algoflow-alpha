// Every user-visible string comes from a catalog. `en.json` is the only one; the `ja` slot
// takes `ja.json`, which with the locale switch is all Japanese adds.
import en from "./en.json";
import { flatten } from "./flatten";

type Messages = typeof en;

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Locale = "en" | "ja";
export type Params = Record<string, string | number>;

export const LOCALES = ["en", "ja"] as const satisfies readonly Locale[];

// `import.meta.env` exists under Vite and Vitest only; scripts run with tsx.
// oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- undefined under tsx
const DEV = Boolean(import.meta.env?.DEV);

const catalogs: Record<Locale, Record<string, string>> = { en: flatten(en), ja: {} };
let current: Locale = "en";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Replaces each `{name}` with `fill(name)`; a placeholder `fill` has no text for stays as written. */
export function fillPlaceholders(text: string, fill: (name: string) => string | undefined): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => fill(name) ?? match);
}

export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return fillPlaceholders(text, (name) =>
    Object.hasOwn(params, name) ? String(params[name]) : undefined,
  );
}

export function t(key: MessageKey, params?: Params): string {
  const text = catalogs[current][key] ?? catalogs.en[key];
  if (text === undefined) {
    if (DEV) console.warn(`i18n: unknown key "${key}"`);
    return key;
  }
  return interpolate(text, params);
}

/** The one place a registry key becomes an i18n key (the key check does not scan dynamic keys). */
export function nodeText(key: string, part: string, params?: Record<string, string>): string {
  return t(`node.${key}.${part}` as MessageKey, params);
}

/** An error's params as its message writes them: `op`, a registry key, as that block's label. */
export function errorParams(params: Params): Params {
  const { op } = params;
  return typeof op === "string" ? { ...params, op: nodeText(op, "label") } : params;
}

/** The message of a diagnostic or runtime error. */
export function errorText(error: { code: string; params: Params }): string {
  return t(`error.${error.code}` as MessageKey, errorParams(error.params));
}

/** A challenge-file text (`Localized`) in the current locale, falling back to `en`. */
export function localized(text: { en: string; ja?: string }): string {
  return text[current] ?? text.en;
}
