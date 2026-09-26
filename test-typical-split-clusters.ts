/**
 * Khi dải bị ô thủng / sàn thấp cắt: mỗi cụm liên tục phải có cây điển hình.
 * Case giống mặt bằng user:
 * - Y thiếu tại 1-2/D-E (cột mở có ô thủng C-D)
 * - X thiếu tại 1-3/B-C (hàng có sàn thấp cắt ở 3-4)
 * - Y thiếu tại 3-4/A-B (cột có sàn thấp cắt ở B-C)
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  baySlabExtent,
  applyAxesToProject,
  groupTypicalRebarByBayStrip,
} from "./lib/grid";
import type { RebarBarSeg } from "./lib/grid";
import { uid } from "./lib/utils";

function barOverlapsBay(
  bar: RebarBarSeg,
  e: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  if (bar.dir === "X") {
    return (
      bar.y > e.y0 + 1 &&
      bar.y < e.y1 - 1 &&
      bar.x1 > e.x0 + 50 &&
      bar.x0 < e.x1 - 50
    );
  }
  return (
    bar.x > e.x0 + 1 &&
    bar.x < e.x1 - 1 &&
    bar.y1 > e.y0 + 50 &&
    bar.y0 < e.y1 - 50
  );
}

function main() {
  let p = createSampleS1();
  // 4×4 bays: axes 1..5 / A..E
  const xs = [0, 3600, 7200, 11400, 14850];
  const ys = [0, 3350, 6800, 10350, 13700];
  p = {
    ...p,
    planWidth: xs[xs.length - 1]!,
    planHeight: ys[ys.length - 1]!,
    axesX: xs.map((pos, i) => ({ id: uid("ax"), name: String(i + 1), pos })),
    axesY: ys.map((pos, i) => ({
      id: uid("ay"),
      name: String.fromCharCode(65 + i),
      pos,
    })),
  };
  p = applyAxesToProject(p);
  const ax = sortAxes(p.axesX ?? []);
  const ay = sortAxes(p.axesY ?? []);

  // Ô1 tại 1-2 / C-D → ix=0, iy=2
  const opE = baySlabExtent(p, ax, ay, 0, 2);
  p.openings = [
    {
      id: "op1",
      name: "Ô1",
      x: opE.x0,
      y: opE.y0,
      w: opE.x1 - opE.x0,
      h: opE.y1 - opE.y0,
    },
  ];
  // Sàn hạ cắt tại 3-4 / B-C → ix=2, iy=1
  const lowE = baySlabExtent(p, ax, ay, 2, 1);
  p.lowSlabs = [
    {
      id: "ls1",
      name: "Sàn hạ",
      x: lowE.x0,
      y: lowE.y0,
      w: lowE.x1 - lowE.x0,
      h: lowE.y1 - lowE.y0,
      drop: 200,
      rebarMode: "cut",
    },
  ];

  const bars = stripRebarBarSegments(p, ax, ay);
  const zones = effectiveZones(p);
  const strips = groupTypicalRebarByBayStrip(p, bars, ax, ay, zones);
  const draw = typicalLayeredRebarBars(p, bars, zones).filter((b) => b.layer === "bottom");

  const bayDE = baySlabExtent(p, ax, ay, 0, 3); // 1-2/D-E
  const bayBC_left = baySlabExtent(p, ax, ay, 0, 1); // 1-2/B-C
  const bayBC_mid = baySlabExtent(p, ax, ay, 1, 1); // 2-3/B-C
  const bayAB = baySlabExtent(p, ax, ay, 2, 0); // 3-4/A-B

  const y_DE = draw.filter((b) => b.dir === "Y" && barOverlapsBay(b, bayDE));
  const x_BC_left = draw.filter((b) => b.dir === "X" && barOverlapsBay(b, bayBC_left));
  const x_BC_mid = draw.filter((b) => b.dir === "X" && barOverlapsBay(b, bayBC_mid));
  const y_AB = draw.filter((b) => b.dir === "Y" && barOverlapsBay(b, bayAB));

  console.log({
    yStrips: strips.filter((s) => s.typical.dir === "Y").length,
    xStrips: strips.filter((s) => s.typical.dir === "X").length,
    y_DE: y_DE.length,
    x_BC_left: x_BC_left.length,
    x_BC_mid: x_BC_mid.length,
    y_AB: y_AB.length,
    drawBottom: draw.length,
  });

  const fail: string[] = [];
  if (!y_DE.length) fail.push("missing Y at 1-2/D-E");
  if (!x_BC_left.length && !x_BC_mid.length) fail.push("missing X at 1-3/B-C");
  // Prefer both left bays covered by at least one X overlapping the run
  const xCovers13 = draw.some(
    (b) =>
      b.dir === "X" &&
      b.y > bayBC_left.y0 + 1 &&
      b.y < bayBC_left.y1 - 1 &&
      b.x0 < bayBC_left.x1 - 50 &&
      b.x1 > bayBC_mid.x0 + 50,
  );
  if (!xCovers13 && !(x_BC_left.length && x_BC_mid.length)) {
    fail.push("missing X covering 1-3/B-C");
  }
  if (!y_AB.length) fail.push("missing Y at 3-4/A-B");

  // Continuous sample still 1 Y typical per column (no cuts): smoke via strip count ≥ columns
  if (fail.length) {
    console.error("FAIL", fail);
    for (const b of draw) {
      console.error(
        " ",
        b.dir,
        b.dir === "X"
          ? `${b.x0.toFixed(0)}-${b.x1.toFixed(0)}@${b.y.toFixed(0)}`
          : `${b.y0.toFixed(0)}-${b.y1.toFixed(0)}@${b.x.toFixed(0)}`,
      );
    }
    process.exit(1);
  }
  console.log("OK split clusters");
}

main();
