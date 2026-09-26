/**
 * Ô sàn thấp chế độ cắt: vẫn bố trí thép X+Y trong ô;
 * ô kề (sàn thường) vẫn còn thép phương X và Y.
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  baySlabExtent,
  cutLowSlabRebarSegments,
  applyAxesToProject,
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

function assertCase(
  label: string,
  p: ReturnType<typeof createSampleS1>,
  lowIx: number,
  lowIy: number,
  adjIx: number,
  adjIy: number,
) {
  const ax = sortAxes(p.axesX ?? []);
  const ay = sortAxes(p.axesY ?? []);
  const lowE = baySlabExtent(p, ax, ay, lowIx, lowIy);
  const adjE = baySlabExtent(p, ax, ay, adjIx, adjIy);
  p.lowSlabs = [
    {
      id: "ls1",
      name: "S11",
      x: lowE.x0,
      y: lowE.y0,
      w: lowE.x1 - lowE.x0,
      h: lowE.y1 - lowE.y0,
      drop: 200,
      rebarMode: "cut",
    },
  ];
  p.openings = [];

  const cutOwn = cutLowSlabRebarSegments(p, ax, ay);
  const draw = typicalLayeredRebarBars(p, stripRebarBarSegments(p, ax, ay), effectiveZones(p));
  const lowX = draw.filter((b) => b.dir === "X" && barOverlapsBay(b, lowE));
  const lowY = draw.filter((b) => b.dir === "Y" && barOverlapsBay(b, lowE));
  const adjX = draw.filter((b) => b.dir === "X" && barOverlapsBay(b, adjE));
  const adjY = draw.filter((b) => b.dir === "Y" && barOverlapsBay(b, adjE));

  console.log(label, {
    cutOwn: cutOwn.length,
    lowX: lowX.length,
    lowY: lowY.length,
    adjX: adjX.length,
    adjY: adjY.length,
    draw: draw.length,
  });

  const fail: string[] = [];
  if (!cutOwn.some((b) => b.dir === "X")) fail.push("cutLow missing X");
  if (!cutOwn.some((b) => b.dir === "Y")) fail.push("cutLow missing Y");
  if (!lowX.length) fail.push("missing X in low-cut bay");
  if (!lowY.length) fail.push("missing Y in low-cut bay");
  if (!adjX.length) fail.push("missing X in adjacent bay");
  if (!adjY.length) fail.push("missing Y in adjacent bay");
  // Không còn mẩu Y/X siêu ngắn làm điển hình trong ô thấp
  const stubs = draw.filter((b) => {
    const len = b.dir === "X" ? b.x1 - b.x0 : b.y1 - b.y0;
    return len < 300 && barOverlapsBay(b, lowE);
  });
  if (stubs.length) fail.push(`stub typicals in low bay: ${stubs.length}`);
  if (fail.length) {
    console.error(label, "FAIL", fail);
    for (const b of draw) {
      console.error(
        " ",
        b.dir,
        b.layer,
        b.dir === "X"
          ? `${b.x0.toFixed(0)}-${b.x1.toFixed(0)}@${b.y.toFixed(0)}`
          : `${b.y0.toFixed(0)}-${b.y1.toFixed(0)}@${b.x.toFixed(0)}`,
      );
    }
    process.exit(1);
  }
}

function main() {
  // 2×1 sample
  assertCase("2x1", createSampleS1(), 0, 0, 1, 0);

  // 2×2 giống mặt bằng user (ô thấp + ô kề phải)
  let p = createSampleS1();
  p = {
    ...p,
    planWidth: 8400,
    planHeight: 7100,
    axesX: [
      { id: uid("ax"), name: "1", pos: 0 },
      { id: uid("ax"), name: "2", pos: 4200 },
      { id: uid("ax"), name: "3", pos: 8400 },
    ],
    axesY: [
      { id: uid("ay"), name: "A", pos: 0 },
      { id: uid("ay"), name: "B", pos: 3550 },
      { id: uid("ay"), name: "C", pos: 7100 },
    ],
  };
  p = applyAxesToProject(p);
  assertCase("2x2", p, 0, 0, 1, 0);

  console.log("OK");
}

main();
