// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { LAYOUT_STORAGE_KEY, mergePersisted, PANEL, panelWidth, SPEEDS, useLayout } from "./layout";

describe("layout store (U-03, U-24, U-60)", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayout.setState({ panel: PANEL.default, collapsed: false, speed: SPEEDS.normal });
  });

  it("starts at 320 px, expanded", () => {
    expect(useLayout.getState()).toMatchObject({ panel: 320, collapsed: false });
  });

  it("U-03: the panel is set between 280 px and half the viewport width, rounded", () => {
    const { setPanel } = useLayout.getState();
    setPanel(10, 1280);
    expect(useLayout.getState().panel).toBe(280);
    setPanel(9999, 1280);
    expect(useLayout.getState().panel).toBe(640);
    setPanel(9999, 1000);
    expect(useLayout.getState().panel).toBe(500);
    setPanel(300.4, 1280);
    expect(useLayout.getState().panel).toBe(300);
    setPanel(Number.NaN, 1280); // a drag that yields no number: the width stays
    expect(useLayout.getState().panel).toBe(300);
  });

  it("U-03: panelWidth draws a stored width within the bounds of the present viewport", () => {
    expect(panelWidth(900, 1280)).toBe(640);
    expect(panelWidth(900, 1920)).toBe(900);
    expect(panelWidth(320, 1280)).toBe(320);
    expect(panelWidth(100, 1280)).toBe(280);
    expect(panelWidth(400, 500)).toBe(280); // a viewport under 560 px: the lower bound prevails
    expect(panelWidth(333.3, 1281)).toBe(333);
  });

  it("U-60, R-26: the speed is Normal at first, one of 1, 4, and 15, and persists", () => {
    expect(useLayout.getState().speed).toBe(4);
    useLayout.getState().setSpeed(SPEEDS.fast);
    expect(useLayout.getState().speed).toBe(15);
    useLayout.getState().setSpeed(Number.NaN);
    expect(useLayout.getState().speed).toBe(15);
    const saved: unknown = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}");
    expect(saved).toMatchObject({ speed: 15 });
    const current = useLayout.getState();
    // A speed stored by the former slider becomes the nearest of the three.
    expect(mergePersisted({ speed: 50 }, current).speed).toBe(15);
    expect(mergePersisted({ speed: 3 }, current).speed).toBe(4);
    expect(mergePersisted({ speed: "fast" }, current).speed).toBe(4);
  });

  it("U-114: persists the width, the collapsed state, and the speed as a bare record", () => {
    useLayout.getState().setPanel(360, 1280);
    useLayout.getState().setCollapsed(true);
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved: unknown = JSON.parse(raw ?? "{}");
    expect(saved).toEqual({ panel: 360, collapsed: true, speed: SPEEDS.normal });
    expect(localStorage.length).toBe(1);
  });

  it("validates a stored snapshot instead of trusting it", () => {
    const current = useLayout.getState();
    // The upper bound depends on the viewport, so it is applied by panelWidth(), not here.
    expect(mergePersisted({ panel: 9999, collapsed: "yes" }, current)).toMatchObject({
      panel: 9999,
      collapsed: false,
    });
    expect(mergePersisted({ panel: 12 }, current).panel).toBe(280);
    expect(mergePersisted({ panel: "wide", collapsed: true }, current)).toMatchObject({
      panel: 320,
      collapsed: true,
    });
    expect(mergePersisted(null, current)).toMatchObject({ panel: 320, collapsed: false });
    // A snapshot of the retired shell (left / right / bottom / palette) yields the defaults.
    expect(
      mergePersisted({ left: 240, right: 320, bottom: 280, palette: {} }, current),
    ).toMatchObject({ panel: 320, collapsed: false });
  });

  it("re-hydrates from storage through the same validation", async () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ panel: 5000, collapsed: true }));
    await useLayout.persist.rehydrate();
    expect(useLayout.getState()).toMatchObject({ panel: 5000, collapsed: true });
    expect(panelWidth(useLayout.getState().panel, 1280)).toBe(640);
  });
});
