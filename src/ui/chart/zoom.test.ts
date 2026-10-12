// Fit to width, never above 100 %; steps of 1.25 between 25 % and 200 %.
import { describe, expect, it } from "vitest";
import { fitScale, zoomStep } from "./zoom";

describe("fitScale", () => {
  it("shrinks a chart wider than its region and never enlarges a narrow one", () => {
    expect(fitScale(500, 1000)).toBe(0.5);
    expect(fitScale(1000, 400)).toBe(1);
  });

  it("stops at 25 % and treats an unmeasured region as 100 %", () => {
    expect(fitScale(100, 1000)).toBe(0.25);
    expect(fitScale(0, 1000)).toBe(1);
    expect(fitScale(500, 0)).toBe(1);
  });
});

describe("zoomStep", () => {
  it("multiplies or divides by 1.25 within 25 % and 200 %", () => {
    expect(zoomStep(1, 1)).toBe(1.25);
    expect(zoomStep(1, -1)).toBe(0.8);
    expect(zoomStep(1.8, 1)).toBe(2);
    expect(zoomStep(0.3, -1)).toBe(0.25);
  });
});
