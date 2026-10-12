// The four pages and their hash routes; a hash that names nothing, a problem id with no
// challenge, or a Playground id the Playground does not list, shows the Problems page. A route
// that names a program opens it before React draws its page, so no page ever draws with the
// program of the page before.
import { useSyncExternalStore } from "react";
import { getChallenge } from "@/challenges";
import { openProgram } from "@/store/open";
import { isListed } from "@/store/playground";

export type Route =
  | { page: "problems" }
  | { page: "problem"; id: string }
  | { page: "playground" }
  | { page: "program"; id: string };

const PROBLEMS: Route = { page: "problems" };

function decode(segment: string): string | undefined {
  try {
    const text = decodeURIComponent(segment);
    return text === "" ? undefined : text;
  } catch {
    return undefined;
  }
}

/** The route a hash names by its shape alone; anything else is the Problems page. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "");
  const [first, second, ...rest] = path.split("/").slice(1);
  if (rest.length > 0) return PROBLEMS;
  const param = second === undefined ? undefined : decode(second);
  if (first === "play") {
    if (second === undefined) return { page: "playground" };
    return param === undefined ? PROBLEMS : { page: "program", id: param };
  }
  if (first === "p" && param !== undefined) return { page: "problem", id: param };
  return PROBLEMS;
}

/** As `parseRoute`, with an id that names no challenge or no Playground program sent to Problems. */
export function resolveRoute(hash: string): Route {
  const route = parseRoute(hash);
  if (route.page === "problem" && !getChallenge(route.id)) return PROBLEMS;
  if (route.page === "program" && !isListed(route.id)) return PROBLEMS;
  return route;
}

export function routeHash(route: Route): string {
  switch (route.page) {
    case "problems":
      return "#/";
    case "problem":
      return `#/p/${encodeURIComponent(route.id)}`;
    case "playground":
      return "#/play";
    case "program":
      return `#/play/${encodeURIComponent(route.id)}`;
  }
}

let current: Route = PROBLEMS;
const listeners = new Set<() => void>();

/** Takes the route the hash names: its program opened first, then the pages told. */
function follow(): void {
  current = resolveRoute(window.location.hash);
  if (current.page === "problem" || current.page === "program") openProgram(current.id);
  for (const listener of listeners) listener();
}

/** Follows the hash from now on; called once, before the first render. */
export function startRouting(): void {
  follow();
  window.addEventListener("hashchange", follow);
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current);
}

export function navigate(route: Route): void {
  window.location.hash = routeHash(route);
}
