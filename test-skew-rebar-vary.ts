/**
 * Dầm lệch/xéo → thép biến thiên chiều dài (nhiều dạng L theo phương).
 */
import { createSampleS1 } from "./lib/sample";
import {
  ensureBeamsSplitBays,
  groupTypicalRebarBars,
  patchBeamAllSegShifts,
  rebarBarStraightLenMm,
  sortAxes,
  stripRebarBarSegments,
} from "./lib/grid";
import { computeModel, effectiveZones } from "./lib/calc";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let p = createSampleS1();
const bot = p.beams.find((b) => b.direction === "X" && Math.abs(b.axis) < 1)!;
const top = p.beams.find((b) => b.direction === "X" && Math.abs(b.axis - 4500) < 1)!;
const left = p.beams.find((b) => b.direction === "Y" && Math.abs(b.axis) < 1)!;
assert(bot && top && left, "missing edge beams");

p = patchBeamAllSegShifts(p, bot.id, { s0: 200, s1: 900 });
p = patchBeamAllSegShifts(p, top.id, { s0: -200, s1: -900 });
p = patchBeamAllSegShifts(p, left.id, { s0: 0, s1: 400 });
p = ensureBeamsSplitBays(p);
p = { ...p, zones: effectiveZones(p) };

const axesX = sortAxes(p.axesX ?? []);
const axesY = sortAxes(p.axesY ?? []);
const bars = stripRebarBarSegments(p, axesX, axesY);
const yBars = bars.filter((b) => b.dir === "Y");
const xBars = bars.filter((b) => b.dir === "X");
assert(yBars.length >= 5, `expected many Y bars, got ${yBars.length}`);
assert(xBars.length >= 5, `expected many X bars, got ${xBars.length}`);

const yLens = yBars.map(rebarBarStraightLenMm);
const xLens = xBars.map(rebarBarStraightLenMm);
const ySpan = Math.max(...yLens) - Math.min(...yLens);
const xSpan = Math.max(...xLens) - Math.min(...xLens);
assert(ySpan > 200, `Y lengths should vary with skewed top/bottom, span=${ySpan}`);
assert(xSpan > 50, `X lengths should vary with skewed left, span=${xSpan}`);

const groups = groupTypicalRebarBars(p, bars, p.zones);
const yGroups = groups.filter((g) => g.typical.dir === "Y");
const xGroups = groups.filter((g) => g.typical.dir === "X");
assert(yGroups.length >= 2, `expected ≥2 Y length types, got ${yGroups.length}`);
assert(xGroups.length >= 2, `expected ≥2 X length types, got ${xGroups.length}`);

const model = computeModel(p);
const botY = model.schedule.filter((r) => r.layer === "bottom" && r.direction === "Y");
assert(botY.length >= 2, `schedule should list multiple Y lengths, got ${botY.length}`);
const schLens = botY.map((r) => r.barLength);
assert(Math.max(...schLens) - Math.min(...schLens) > 100, "schedule Y lengths should differ");

console.log("OK skew rebar vary", {
  xBars: xBars.length,
  yBars: yBars.length,
  xTypes: xGroups.length,
  yTypes: yGroups.length,
  ySpan,
  xSpan,
  scheduleY: botY.map((r) => ({ L: r.barLength, qty: r.qtyEach })),
});
