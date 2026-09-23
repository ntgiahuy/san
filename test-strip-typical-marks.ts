/**
 * Minh họa: 1 thanh điển hình / dải ô (Y: 1–2 và 2–3).
 * Thống kê: biến thiên → Xa/Xb/Xc; đều → một số hiệu.
 */
import { createSampleS1 } from "./lib/sample";
import {
  ensureBeamsSplitBays,
  groupTypicalRebarByBayStrip,
  patchBeamAllSegShifts,
  rebarBarStraightLenMm,
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
} from "./lib/grid";
import { computeModel, effectiveZones } from "./lib/calc";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let p = createSampleS1();
const bot = p.beams.find((b) => b.direction === "X" && Math.abs(b.axis) < 1)!;
const top = p.beams.find((b) => b.direction === "X" && Math.abs(b.axis - 4500) < 1)!;
const left = p.beams.find((b) => b.direction === "Y" && Math.abs(b.axis) < 1)!;
p = patchBeamAllSegShifts(p, bot.id, { s0: 0, s1: 1000 });
p = patchBeamAllSegShifts(p, top.id, { s0: 0, s1: -1000 });
p = patchBeamAllSegShifts(p, left.id, { s0: -100, s1: 500 });
p = ensureBeamsSplitBays(p);
p = { ...p, zones: effectiveZones(p) };

const axesX = sortAxes(p.axesX ?? []);
const axesY = sortAxes(p.axesY ?? []);
const bars = stripRebarBarSegments(p, axesX, axesY);
const strips = groupTypicalRebarByBayStrip(p, bars, axesX, axesY, p.zones);
const yStrips = strips.filter((s) => s.typical.dir === "Y");
assert(yStrips.length === 2, `expected 2 Y strips (1-2, 2-3), got ${yStrips.length}`);

const draw = typicalLayeredRebarBars(p, bars, p.zones).filter((b) => b.layer !== "top");
const drawY = draw.filter((b) => b.dir === "Y");
assert(drawY.length === 2, `expected 2 typical Y bars on plan, got ${drawY.length}`);

const model = computeModel(p);
const botY = model.schedule.filter((r) => r.layer === "bottom" && r.direction === "Y");
const marks = botY.map((r) => r.mark);
assert(
  marks.some((m) => /a$/.test(m)) && marks.some((m) => /b$/.test(m)),
  `expected Xa/Xb style marks, got ${marks.join(",")}`,
);
const families = new Set(marks.map((m) => m.match(/^([A-Z]+)/)?.[1] ?? m));
assert(families.size === 2, `expected 2 Y families (strips), got ${[...families]} from ${marks.join(",")}`);

for (const fam of families) {
  const rows = botY.filter((r) => (r.mark.match(/^([A-Z]+)/)?.[1] ?? r.mark) === fam);
  assert(rows.length <= 3, `family ${fam} should have ≤3 variants, got ${rows.length}`);
  const qtySum = rows.reduce((s, r) => s + r.qtyEach, 0);
  assert(qtySum >= 2, `family ${fam} qty sum ${qtySum}`);
}

console.log("OK strip typical + Xa/Xb/Xc", {
  yStrips: yStrips.map((s) => ({ strip: s.stripIndex, n: s.bars.length, L: rebarBarStraightLenMm(s.typical) })),
  drawY: drawY.length,
  scheduleY: botY.map((r) => ({ mark: r.mark, L: r.barLength, qty: r.qtyEach })),
});
