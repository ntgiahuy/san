/**
 * Mỗi số hiệu (Ø+a+L+móc) có khoảng rải riêng trên minh họa;
 * thép sàn thấp cắt → khoảng rải neo đúng bao ô thấp.
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  baySlabExtent,
  applyAxesToProject,
  buildMergedDistRanges,
  distRangeJunctionsOnBars,
  slabDistRangeForBar,
  barOwnedByCutLowSlab,
  rebarBarStraightLenMm,
  hooksForRebarBar,
  ensureBeamsSplitBays,
} from "./lib/grid";
import { uid } from "./lib/utils";

let p = createSampleS1();
const xs = [0, 4000, 8500, 13000, 17000];
const ys = [0, 3750, 7500, 11250, 15000];
p = {
  ...p,
  planWidth: 17000,
  planHeight: 15000,
  axesX: xs.map((pos, i) => ({ id: uid("ax"), name: String(i + 1), pos })),
  axesY: ys.map((pos, i) => ({
    id: uid("ay"),
    name: String.fromCharCode(65 + i),
    pos,
  })),
};
p = applyAxesToProject(p);
p = ensureBeamsSplitBays(p);
const ax = sortAxes(p.axesX ?? []);
const ay = sortAxes(p.axesY ?? []);
const lowE = baySlabExtent(p, ax, ay, 2, 1);
p.lowSlabs = [
  {
    id: "ls1",
    name: "ST1",
    x: lowE.x0,
    y: lowE.y0,
    w: lowE.x1 - lowE.x0,
    h: lowE.y1 - lowE.y0,
    drop: 50,
    rebarMode: "cut",
  },
];

const zones = effectiveZones(p);
const bars = stripRebarBarSegments(p, ax, ay);
const drawBars = typicalLayeredRebarBars(p, bars, zones);

const markKeyOf = (bar: (typeof bars)[number]) => {
  const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
  const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
  const hits = zones.filter((z) => {
    if (z.direction !== bar.dir) return false;
    const zx0 = Math.min(z.x1, z.x2);
    const zx1 = Math.max(z.x1, z.x2);
    const zy0 = Math.min(z.y1, z.y2);
    const zy1 = Math.max(z.y1, z.y2);
    return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
  });
  const z = hits.find((h) => h.layer === "bottom") ?? hits[0];
  const hooks = hooksForRebarBar(p, bar, zones);
  const len = Math.round(rebarBarStraightLenMm(bar) + hooks.left + hooks.right);
  if (z) {
    return `${z.mark}|${z.dia}|${z.spacing}|${z.direction}|L${len}|H${hooks.left}/${hooks.right}`;
  }
  return `${bar.dir}|10|150|L${len}|H${hooks.left}/${hooks.right}`;
};

const merged = buildMergedDistRanges(p, ax, ay, bars, markKeyOf, undefined, zones);
const cutY = drawBars.filter((b) => b.dir === "Y" && barOwnedByCutLowSlab(p, b));
if (!cutY.length) {
  console.log("FAIL no cut-low Y typical");
  process.exit(1);
}

let ok = true;
for (const bar of cutY) {
  const raw = slabDistRangeForBar(p, ax, ay, bar);
  const expect = lowE.x1 - lowE.x0 - 100; // ± inset 50
  if (!raw || Math.abs(raw.lenMm - expect) > 1) {
    console.log("FAIL cut-low dist not bay-local", raw, "expect~", expect);
    ok = false;
  }
  const hits = merged.filter((seg) => distRangeJunctionsOnBars(seg, [bar]).length > 0);
  if (!hits.length) {
    console.log("FAIL cut-low bar missing merged dist junction", bar);
    ok = false;
  } else {
    if (bar.dir !== "Y") continue;
    const my = (bar.y0 + bar.y1) / 2;
    const nearest = hits.reduce((a, b) =>
      Math.abs((a.yA + a.yB) / 2 - my) <= Math.abs((b.yA + b.yB) / 2 - my) ? a : b,
    );
    const delta = Math.abs((nearest.yA + nearest.yB) / 2 - my);
    if (delta > 1) {
      console.log("FAIL cut-low dist not at bar mid", { delta, nearest, my });
      ok = false;
    }
    if (Math.abs(nearest.lenMm - expect) > 1) {
      console.log("FAIL merged cut-low dist len", nearest.lenMm, expect);
      ok = false;
    }
  }
}

// Mỗi markKey (số hiệu) trong cùng strip không bị gộp với markKey khác
const byStrip = new Map<string, Set<string>>();
for (const m of merged.filter((d) => d.dir === "Y")) {
  const strip = `${Math.round(m.yA)}`;
  const set = byStrip.get(strip) ?? new Set();
  set.add(m.markKey);
  byStrip.set(strip, set);
}
const multi = [...byStrip.entries()].filter(([, s]) => s.size > 1);
// Cho phép nhiều số hiệu / strip — miễn là mỗi cái có đường riêng (count >= size)
for (const [strip, keys] of multi) {
  const n = merged.filter((d) => d.dir === "Y" && Math.round(d.yA) === Number(strip)).length;
  if (n < keys.size) {
    console.log("FAIL strip merged away distinct marks", strip, n, keys.size);
    ok = false;
  }
}

console.log(ok ? "PASS dist per STT + cut-low bay-local" : "FAIL", {
  merged: merged.length,
  cutY: cutY.length,
  cutDist: cutY[0] ? slabDistRangeForBar(p, ax, ay, cutY[0])?.lenMm : null,
  multiStrips: multi.length,
});
process.exit(ok ? 0 : 1);
