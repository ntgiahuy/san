/**
 * Ô thủng = trống → thép sàn / cây điển hình không được đi xuyên ô.
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  baySlabExtent,
  reanchorBarEndsToCover,
} from "./lib/grid";
import type { RebarBarSeg } from "./lib/grid";

function crossesOpening(
  bar: RebarBarSeg,
  e: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  const mx = (e.x0 + e.x1) / 2;
  const my = (e.y0 + e.y1) / 2;
  if (bar.dir === "X") {
    return bar.y > e.y0 + 1 && bar.y < e.y1 - 1 && bar.x0 < mx && bar.x1 > mx;
  }
  return bar.x > e.x0 + 1 && bar.x < e.x1 - 1 && bar.y0 < my && bar.y1 > my;
}

function main() {
  const p = createSampleS1();
  const ax = sortAxes(p.axesX ?? []);
  const ay = sortAxes(p.axesY ?? []);
  const e = baySlabExtent(p, ax, ay, 0, 0);
  p.openings = [{ id: "op1", name: "Ô1", x: e.x0, y: e.y0, w: e.x1 - e.x0, h: e.y1 - e.y0 }];

  const bars = stripRebarBarSegments(p, ax, ay);
  const stripBad = bars.filter((b) => crossesOpening(b, e));
  console.log("strip through opening:", stripBad.length, "/", bars.length);

  const cutSeg = bars.find((b) => b.dir === "X" && b.y > e.y0 && b.y < e.y1);
  if (cutSeg) {
    const re = reanchorBarEndsToCover(p, cutSeg);
    console.log("reanchor crosses?", crossesOpening(re, e), re);
  }

  const draw = typicalLayeredRebarBars(p, bars, effectiveZones(p));
  const drawBad = draw.filter((b) => crossesOpening(b, e));
  console.log("typical through opening:", drawBad.length, "/", draw.length);
  for (const b of drawBad) console.log("  ", b);

  if (stripBad.length || drawBad.length) {
    console.error("FAIL: rebar crosses opening");
    process.exit(1);
  }
  console.log("OK");
}

main();
