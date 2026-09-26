/**
 * Khoảng rải không bắt qua ô thủng; thanh điển hình cạnh ô vẫn có khoảng rải.
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  baySlabExtent,
  ensureBeamsSplitBays,
  buildMergedDistRanges,
  slabDistRangeForBar,
  rebarBarStraightLenMm,
  hooksForRebarBar,
  distRangeJunctionsOnBars,
  bayHasSlabRebar,
} from "./lib/grid";
import { uid } from "./lib/utils";
import type { PlanBeam, SlabProject } from "./lib/types";

function buildProject(): SlabProject {
  const xs = [0, 3700, 8000, 12300];
  const ys = [0, 3750, 7500, 11250, 15000];
  const axesX = xs.map((pos, i) => ({ id: uid("ax"), name: String(i + 1), pos }));
  const axesY = ys.map((pos, i) => ({
    id: uid("ay"),
    name: String.fromCharCode(65 + i),
    pos,
  }));
  const beams: PlanBeam[] = [];
  for (const a of axesX) {
    beams.push({
      id: uid("bm"),
      name: `D${a.name}`,
      direction: "Y",
      axis: a.pos,
      axisId: a.id,
      start: 0,
      end: 15000,
      size: "200x400",
      offset: 0,
    });
  }
  for (const a of axesY) {
    beams.push({
      id: uid("bm"),
      name: `D${a.name}`,
      direction: "X",
      axis: a.pos,
      axisId: a.id,
      start: 0,
      end: 12300,
      size: "200x400",
      offset: 0,
    });
  }
  let p = createSampleS1();
  p = {
    ...p,
    planWidth: 12300,
    planHeight: 15000,
    axesX,
    axesY,
    beams,
    info: { ...p.info, showDistRange: true },
  };
  p = ensureBeamsSplitBays(p);
  const ax = sortAxes(p.axesX ?? []);
  const ay = sortAxes(p.axesY ?? []);
  const o1 = baySlabExtent(p, ax, ay, 0, 2); // 1-2 / C-D
  const o2 = baySlabExtent(p, ax, ay, 1, 1); // 2-3 / B-C
  const lowE = baySlabExtent(p, ax, ay, 2, 1); // 3-4 / B-C
  p.openings = [
    { id: "op1", name: "O1", x: o1.x0, y: o1.y0, w: o1.x1 - o1.x0, h: o1.y1 - o1.y0 },
    { id: "op2", name: "O2", x: o2.x0, y: o2.y0, w: o2.x1 - o2.x0, h: o2.y1 - o2.y0 },
  ];
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
  return p;
}

function crossesRect(
  m: { dir: "X" | "Y"; xA: number; yA: number; xB: number; yB: number },
  r: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  // Xuyên phần trong của ô (không tính mép)
  if (m.dir === "Y") {
    const y = (m.yA + m.yB) / 2;
    const x0 = Math.min(m.xA, m.xB);
    const x1 = Math.max(m.xA, m.xB);
    return y > r.y0 + 1 && y < r.y1 - 1 && x0 < r.x1 - 1 && x1 > r.x0 + 1;
  }
  const x = (m.xA + m.xB) / 2;
  const y0 = Math.min(m.yA, m.yB);
  const y1 = Math.max(m.yA, m.yB);
  return x > r.x0 + 1 && x < r.x1 - 1 && y0 < r.y1 - 1 && y1 > r.y0 + 1;
}

function main() {
  const p = buildProject();
  const ax = sortAxes(p.axesX ?? []);
  const ay = sortAxes(p.axesY ?? []);
  const o1 = baySlabExtent(p, ax, ay, 0, 2);
  const o2 = baySlabExtent(p, ax, ay, 1, 1);
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

  // Bỏ dầm C + cập nhật lại bao ô thủng theo extent mới — expand cũ từng xuyên O1
  const ayC = ay[2]!;
  const pNoC: SlabProject = {
    ...p,
    beams: (p.beams ?? []).filter(
      (b) => !(b.direction === "X" && Math.abs(b.axis - ayC.pos) < 1),
    ),
  };
  const o1NoC = baySlabExtent(pNoC, ax, ay, 0, 2);
  pNoC.openings = [
    {
      id: "op1",
      name: "O1",
      x: o1NoC.x0,
      y: o1NoC.y0,
      w: o1NoC.x1 - o1NoC.x0,
      h: o1NoC.y1 - o1NoC.y0,
    },
    ...((p.openings ?? []).filter((o) => o.id !== "op1") as NonNullable<SlabProject["openings"]>),
  ];
  const barsNoC = stripRebarBarSegments(pNoC, ax, ay);
  const bayBC = baySlabExtent(pNoC, ax, ay, 0, 1);
  const xBar = barsNoC.find(
    (b) =>
      b.dir === "X" &&
      b.y >= bayBC.y0 - 1 &&
      b.y <= bayBC.y1 + 1 &&
      (b.x0 + b.x1) / 2 >= bayBC.x0 &&
      (b.x0 + b.x1) / 2 <= bayBC.x1,
  );
  if (!xBar) {
    console.error("FAIL: no X bar in 1-2/B-C");
    process.exit(1);
  }
  const raw = slabDistRangeForBar(pNoC, ax, ay, xBar);
  if (!raw) {
    console.error("FAIL: no dist for X bar in B-C");
    process.exit(1);
  }
  const yHi = Math.max(raw.yA, raw.yB);
  if (yHi > o1NoC.y0 + 1) {
    console.error("FAIL: raw dist expands into O1 without beam C", {
      yHi: Math.round(yHi),
      o1y0: Math.round(o1NoC.y0),
      len: Math.round(raw.lenMm),
    });
    process.exit(1);
  }

  const mergedNoC = buildMergedDistRanges(
    pNoC,
    ax,
    ay,
    barsNoC,
    markKeyOf,
    undefined,
    zones,
  );
  const o1r = {
    x0: o1NoC.x0,
    y0: o1NoC.y0,
    x1: o1NoC.x1,
    y1: o1NoC.y1,
  };
  const o2r = { x0: o2.x0, y0: o2.y0, x1: o2.x1, y1: o2.y1 };
  const crossO1 = mergedNoC.filter((m) => crossesRect(m, o1r));
  if (crossO1.length) {
    console.error(
      "FAIL: merged dist crosses O1",
      crossO1.map((m) => ({ dir: m.dir, len: Math.round(m.lenMm) })),
    );
    process.exit(1);
  }

  // Đủ dầm
  const merged = buildMergedDistRanges(p, ax, ay, bars, markKeyOf, undefined, zones);
  const fullO1 = { x0: o1.x0, y0: o1.y0, x1: o1.x1, y1: o1.y1 };
  if (merged.some((m) => crossesRect(m, fullO1) || crossesRect(m, o2r))) {
    console.error("FAIL: merged dist crosses opening (full beams)");
    process.exit(1);
  }

  // Cây điển hình Y cột 1-2 chạm ô có thép → phải có khoảng rải giao thanh
  const col0Typical = drawBars.filter((b) => {
    if (b.dir !== "Y") return false;
    const s = baySlabExtent(p, ax, ay, 0, 0);
    return b.x >= s.x0 - 1 && b.x <= s.x1 + 1;
  });
  if (!col0Typical.length) {
    console.error("FAIL: no Y typical in column 1-2");
    process.exit(1);
  }
  let missing = 0;
  for (const b of col0Typical) {
    let touchesSolid = false;
    for (let iy = 0; iy < ay.length - 1; iy++) {
      if (!bayHasSlabRebar(p, ax, ay, 0, iy)) continue;
      const s = baySlabExtent(p, ax, ay, 0, iy);
      if (b.x < s.x0 - 1 || b.x > s.x1 + 1) continue;
      if (Math.min(b.y1, s.y1) - Math.max(b.y0, s.y0) > 1) touchesSolid = true;
    }
    if (!touchesSolid) continue;
    const hits = merged.filter((m) => distRangeJunctionsOnBars(m, [b]).length > 0);
    if (!hits.length) {
      missing++;
      console.error("FAIL: typical Y missing dist junction", {
        x: Math.round(b.x),
        y0: Math.round(b.y0),
        y1: Math.round(b.y1),
        key: markKeyOf(b),
      });
    }
  }
  if (missing) process.exit(1);

  console.log("OK dist skips openings; column 1-2 typicals have ranges");
}

main();
