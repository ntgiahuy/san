/**
 * Ô sàn = 4 dầm xung quanh: dầm free cắt giữa ô phải tách thành nhiều ô chọn được.
 */
import { createEmptyProject } from "../lib/sample";
import {
  applyAxesToProject,
  baySlabExtent,
  ensureBeamsSplitBays,
  sortAxes,
} from "../lib/grid";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function oneWideBay() {
  return applyAxesToProject({
    ...createEmptyProject(),
    axesX: [
      { id: "ax1", name: "5", pos: 0 },
      { id: "ax2", name: "6", pos: 9099 },
    ],
    axesY: [
      { id: "ay1", name: "C", pos: 0 },
      { id: "ay2", name: "D", pos: 4280 },
    ],
  });
}

let p = oneWideBay();
assert((p.axesX.length - 1) * (p.axesY.length - 1) === 1, "start 1 bay");

p = {
  ...p,
  beams: [
    ...p.beams,
    {
      id: "f1",
      name: "DF1",
      size: "220x500",
      direction: "Y" as const,
      axis: 3000,
      free: true,
      start: 0,
      end: 4280,
      offset: 110,
    },
    {
      id: "f2",
      name: "DF2",
      size: "220x500",
      direction: "Y" as const,
      axis: 6000,
      free: true,
      start: 0,
      end: 4280,
      offset: 110,
    },
  ],
};

p = ensureBeamsSplitBays(p);
assert(p.beams.every((b) => !b.free), "no free beams left");
assert(p.axesX.length === 4, `expected 4 X axes, got ${p.axesX.length}`);
assert((p.axesX.length - 1) * (p.axesY.length - 1) === 3, "3 selectable bays");

const ax = sortAxes(p.axesX);
const ay = sortAxes(p.axesY);
const widths: number[] = [];
for (let ix = 0; ix < ax.length - 1; ix++) {
  const e = baySlabExtent(p, ax, ay, ix, 0);
  widths.push(e.x1 - e.x0);
  assert(e.x1 - e.x0 > 500, "each bay has positive width");
  assert(e.x1 - e.x0 < 5000, "no bay spans ~9m across intermediate beams");
}
console.log("bay widths", widths.map((w) => Math.round(w)));
console.log("OK — free beams split wide bay into 3");
