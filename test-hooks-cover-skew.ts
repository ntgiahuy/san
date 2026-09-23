/**
 * Đầu thanh / móc lớp dưới sau lệch 2 lớp phải cách da ngoài = Dày lớp BV
 * (kể cả dầm biên xéo — mặt ngoài đổi theo trạm).
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  beamOuterFacesAtAlong,
  slabCoverMm,
  patchBeamAllSegShifts,
  ensureBeamsSplitBays,
  rebarHookSegments,
  hooksForRebarBar,
} from "./lib/grid";

let p = createSampleS1();
const bot = p.beams.find((b) => b.direction === "X" && Math.abs(b.axis) < 1)!;
const top = p.beams.find((b) => b.direction === "X" && Math.abs(b.axis - p.planHeight) < 1)!;
const left = p.beams.find((b) => b.direction === "Y" && Math.abs(b.axis) < 1)!;
p = patchBeamAllSegShifts(p, bot.id, { s0: 350, s1: 0 });
p = patchBeamAllSegShifts(p, top.id, { s0: -350, s1: 0 });
p = patchBeamAllSegShifts(p, left.id, { s0: -120, s1: 80 });
p = ensureBeamsSplitBays(p);
p = {
  ...p,
  info: { ...p.info, cover: 25, thickness: 120 },
};

const cover = slabCoverMm(p);
const axesX = sortAxes(p.axesX);
const axesY = sortAxes(p.axesY);
const zones = effectiveZones(p);
const bars = stripRebarBarSegments(p, axesX, axesY);
const draw = typicalLayeredRebarBars(p, bars, zones).filter((b) => b.layer === "bottom");

let fail = 0;
for (const bar of draw) {
  if (bar.dir === "X") {
    const L = beamOuterFacesAtAlong(p, "Y", axesX[0]!, bar.y);
    const R = beamOuterFacesAtAlong(p, "Y", axesX[axesX.length - 1]!, bar.y);
    const leftGap = bar.x0 - L.lo;
    const rightGap = R.hi - bar.x1;
    const ok =
      Math.abs(leftGap - cover) < 1.5 &&
      Math.abs(rightGap - cover) < 1.5 &&
      bar.x0 >= L.lo - 0.5 &&
      bar.x1 <= R.hi + 0.5;
    if (!ok) {
      fail++;
      console.log("FAIL X", { y: bar.y, x0: bar.x0, x1: bar.x1, leftGap, rightGap, cover });
    }
    const hooks = rebarHookSegments(
      bar,
      hooksForRebarBar(p, bar, zones).left,
      hooksForRebarBar(p, bar, zones).right,
      p.planWidth,
      p.planHeight,
    );
    for (const h of hooks) {
      const atLeft = Math.abs(h.x1 - bar.x0) < 1;
      const faceLo = atLeft ? L.lo : R.lo;
      const faceHi = atLeft ? L.hi : R.hi;
      if (h.x1 < faceLo - 0.5 || h.x1 > faceHi + 0.5) {
        fail++;
        console.log("FAIL hook X outside beam", { hx: h.x1, faceLo, faceHi });
      }
      // Đầu móc cách da ngoài ≥ lớp BV (nằm trong dầm)
      const distOuter = atLeft ? h.x1 - L.lo : R.hi - h.x1;
      if (distOuter < cover - 1.5) {
        fail++;
        console.log("FAIL hook X cover", { distOuter, cover });
      }
    }
  } else {
    const B = beamOuterFacesAtAlong(p, "X", axesY[0]!, bar.x);
    const T = beamOuterFacesAtAlong(p, "X", axesY[axesY.length - 1]!, bar.x);
    const botGap = bar.y0 - B.lo;
    const topGap = T.hi - bar.y1;
    const ok =
      Math.abs(botGap - cover) < 1.5 &&
      Math.abs(topGap - cover) < 1.5 &&
      bar.y0 >= B.lo - 0.5 &&
      bar.y1 <= T.hi + 0.5;
    if (!ok) {
      fail++;
      console.log("FAIL Y", { x: bar.x, y0: bar.y0, y1: bar.y1, botGap, topGap, cover });
    }
    const hooks = rebarHookSegments(
      bar,
      hooksForRebarBar(p, bar, zones).left,
      hooksForRebarBar(p, bar, zones).right,
      p.planWidth,
      p.planHeight,
    );
    for (const h of hooks) {
      const atBot = Math.abs(h.y1 - bar.y0) < 1;
      const faceLo = atBot ? B.lo : T.lo;
      const faceHi = atBot ? B.hi : T.hi;
      if (h.y1 < faceLo - 0.5 || h.y1 > faceHi + 0.5) {
        fail++;
        console.log("FAIL hook Y outside beam", { hy: h.y1, faceLo, faceHi });
      }
      const distOuter = atBot ? h.y1 - B.lo : T.hi - h.y1;
      if (distOuter < cover - 1.5) {
        fail++;
        console.log("FAIL hook Y cover", { distOuter, cover });
      }
    }
  }
}

console.log(
  fail === 0 ? `PASS hooks inside beam by cover (${draw.length} bars)` : `FAIL (${fail})`,
);
process.exit(fail === 0 ? 0 : 1);
