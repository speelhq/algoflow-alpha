// @vitest-environment jsdom
// The hash routes of the pages built; anything else shows the Problems page.
import { describe, expect, it } from "vitest";
import { PLAYGROUND_KEY } from "@/store/playground";
import { parseRoute, resolveRoute, routeHash, type Route } from "./route";

describe("routes", () => {
  it.each<[string, Route]>([
    ["", { page: "problems" }],
    ["#/", { page: "problems" }],
    ["#/p/fizzbuzz", { page: "problem", id: "fizzbuzz" }],
    ["#/play", { page: "playground" }],
    ["#/play/", { page: "playground" }],
    ["#/play/abc", { page: "program", id: "abc" }],
    ["#/play/my%20heap", { page: "program", id: "my heap" }],
  ])("parses %j", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it("writes the hash each route parses back from", () => {
    const routes: Route[] = [
      { page: "problems" },
      { page: "problem", id: "fizzbuzz" },
      { page: "playground" },
      { page: "program", id: "a b" },
    ];
    for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route);
  });
});

describe("unknown routes", () => {
  it.each(["#/nope", "#/p", "#/p/", "#/modules", "#/m/heap", "#/p/a/b", "#/p/%E0%A4%A"])(
    "shows Problems for %j",
    (hash) => {
      expect(parseRoute(hash)).toEqual({ page: "problems" });
    },
  );

  it("shows Problems for a problem id with no challenge", () => {
    expect(resolveRoute("#/p/nope")).toEqual({ page: "problems" });
    expect(resolveRoute("#/p/fizzbuzz")).toEqual({ page: "problem", id: "fizzbuzz" });
  });

  it("shows Problems for a Playground id the Playground does not list", () => {
    localStorage.setItem(PLAYGROUND_KEY, JSON.stringify({ "play-abcdefghijkl": { edited: 1 } }));
    expect(resolveRoute("#/play/play-abcdefghijkl")).toEqual({
      page: "program",
      id: "play-abcdefghijkl",
    });
    expect(resolveRoute("#/play/play-zzzzzzzzzzzz")).toEqual({ page: "problems" });
    localStorage.clear();
  });
});
