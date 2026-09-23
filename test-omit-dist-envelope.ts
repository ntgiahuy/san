/**
 * 1) Đầu thép trong bao da ± BV khi dầm xéo / hình thang.
 * 2) Xóa dầm giữa → khoảng rải gộp 1 đường liên tục (chạm nhau, không kẽ hở).
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  buildMergedDistRanges,
  baySlabExtent,
  slabCoverMm,
  patchBeamAllSegShifts,
  ensureBeamsSplitBays,
  findBeamOnAxis,
  applyAxisCount,
  beamSegments,
  beamSegKey,
  SLAB_DIST_RANGE_INSET_MM,
  pointInCoverEnvelope,
} from "./lib/grid";

let p = createSampleS1();
p = applyAxisCount({ ...p, planWidth: 6500, planHeight: 4500 }, "X", 3);
p = applyAxisCount({ ...p, planWidth: 6500, planHeight: 4500 }, "Y", 4);
p = {
  ...p,
  planWidth: 6500,
  planHeight: 4500,
  info: { ...p.info, cover: 25, thickness: 120 },
};
p = ensureBeamsSplitBays(p);

let ax = sortAxes(p.axesX);
let ay = sortAxes(p.axesY);
console.log(
  "beams X-dir",
  p.beams.filter((b) => b.direction === "X").map((b) => b.axis),
);

for (const a of [ay[1]!, ay[2]!]) {
  const beam = findBeamOnAxis(p, "X", a);
  if (!beam) throw new Error(`expected beam at Y=${a.pos}`);
  const omit = new Set(beam.omitSegKeys ?? []);
  for (const seg of beamSegments(p, beam)) omit.add(beamSegKey(seg.a0.id, seg.a1.id));
  p = {
    ...p,
    beams: p.beams.map((b) => (b.id === beam.id ? { ...b, omitSegKeys: [...omit] } : b)),
  };
}

ax = sortAxes(p.axesX);
ay = sortAxes(p.axesY);
const bot = findBeamOnAxis(p, "X", ay[0]!);
const top = findBeamOnAxis(p, "X", ay[ay.length - 1]!);
const left = findBeamOnAxis(p, "Y", ax[0]!);
if (!bot || !top || !left) throw new Error("missing edge beam");
p = patchBeamAllSegShifts(p, bot.id, { s0: 450, s1: 0 });
p = patchBeamAllSegShifts(p, top.id, { s0: -450, s1: 0 });
p = patchBeamAllSegShifts(p, left.id, { s0: -80, s1: 200 });
p = ensureBeamsSplitBays(p);
ax = sortAxes(p.axesX);
ay = sortAxes(p.axesY);

const b0 = baySlabExtent(p, ax, ay, 0, 0);
const b1 = baySlabExtent(p, ax, ay, 0, 1);
if (Math.abs(b0.y1 - b1.y0) > 1) {
  console.log("FAIL expected contiguous bays after omit", b0.y1, b1.y0);
  process.exit(1);
}

const cover = slabCoverMm(p);
const zones = effectiveZones(p);
const raw = stripRebarBarSegments(p, ax, ay);
const draw = typicalLayeredRebarBars(p, raw, zones);

let outside = 0;
for (const bar of [...raw, ...draw]) {
  if (bar.dir === "X") {
    if (
      !pointInCoverEnvelope(p, bar.x0, bar.y, cover) ||
      !pointInCoverEnvelope(p, bar.x1, bar.y, cover)
    ) {
      outside++;
    }
  } else if (
    !pointInCoverEnvelope(p, bar.x, bar.y0, cover) ||
    !pointInCoverEnvelope(p, bar.x, bar.y1, cover)
  ) {
    outside++;
  }
}

const merged = buildMergedDistRanges(
  p,
  ax,
  ay,
  raw,
  (bar) => bar.dir,
  SLAB_DIST_RANGE_INSET_MM,
  zones,
);
const vert = merged.filter((s) => s.dir === "X");
const tall = vert.filter((m) => m.lenMm > p.planHeight * 0.6);
const shortGapPieces = vert.filter((m) => m.lenMm > 1200 && m.lenMm < 1600);

const pass = outside === 0 && tall.length >= 1 && shortGapPieces.length === 0;
console.log(
  pass ? "PASS envelope + merged dist across deleted beams" : "FAIL",
  {
    outside,
    tall: tall.length,
    shortGap: shortGapPieces.length,
    vert: vert.length,
    draw: draw.length,
    tallLens: tall.map((t) => Math.round(t.lenMm)),
  },
);
process.exit(pass ? 0 : 1);
