// @vitest-environment jsdom
// U-122: what the focused element owns; the keyboard table's Delete and Backspace stay in an open
// editor; U-60, R-31: Ctrl/Cmd+Enter and the play button run, pause, play, and replay as one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ast, program } from "@/nodes/testing";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { togglePlay } from "./actions";
import { ownsKeys } from "./keys";
import { settle } from "@/store/testing";

const { for_, num, print, v } = ast;

function press(target: Element, key: string, mod = false) {
  return { target, key, ctrlKey: mod, metaKey: false, getModifierState: () => false };
}

function element(html: string): Element {
  document.body.innerHTML = html;
  const found = document.querySelector("[data-focus]");
  if (!found) throw new Error("no focused element");
  return found;
}

describe("ownsKeys (U-122)", () => {
  it("a field or a slider owns every key", () => {
    expect(ownsKeys(press(element("<input data-focus>"), "z", true))).toBe(true);
    expect(ownsKeys(press(element('<div role="slider" data-focus></div>'), "ArrowLeft"))).toBe(
      true,
    );
  });

  it("a value line owns the keys it takes, not Ctrl/Cmd+Z", () => {
    const line = element('<div data-value-line><span data-focus tabindex="0"></span></div>');
    expect(ownsKeys(press(line, "a"))).toBe(true);
    expect(ownsKeys(press(line, "Backspace"))).toBe(true);
    expect(ownsKeys(press(line, "z", true))).toBe(false);
  });

  it("an open editor or menu owns Delete and Backspace only", () => {
    const editor = element('<div role="dialog"><button data-focus></button></div>');
    expect(ownsKeys(press(editor, "Delete"))).toBe(true);
    expect(ownsKeys(press(editor, "Backspace"))).toBe(true);
    expect(ownsKeys(press(editor, "z", true))).toBe(false);
    expect(ownsKeys(press(element("<button data-focus></button>"), "Delete"))).toBe(false);
  });
});

describe("togglePlay (U-60, R-31)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useProgram.setState({ program: program([for_("i", num(0), num(3), [print(v("i"))])]) });
  });
  afterEach(() => {
    useRun.getState().stop();
    vi.useRealTimers();
  });

  it("runs, pauses, plays, and at the last step replays from step 0", async () => {
    togglePlay();
    expect(useRun.getState().busy).toBe(true);
    await settle(new Promise((resolve) => setTimeout(resolve, 0)));
    expect(useRun.getState().status).toBe("playing");
    togglePlay();
    expect(useRun.getState().status).toBe("paused");
    togglePlay();
    expect(useRun.getState().status).toBe("playing");
    await settle(useRun.getState().skip());
    expect(useRun.getState().status).toBe("done");
    togglePlay();
    await settle(new Promise((resolve) => setTimeout(resolve, 0)));
    expect(useRun.getState()).toMatchObject({ status: "playing", step: 0 });
  });

  it("R-31: during the pre-run it pauses, and the run opens paused", async () => {
    togglePlay();
    togglePlay();
    await settle(new Promise((resolve) => setTimeout(resolve, 0)));
    expect(useRun.getState()).toMatchObject({ status: "paused", step: 0, busy: false });
  });
});
