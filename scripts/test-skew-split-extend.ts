/**
 * Dầm lệch: đoạn dầm cắt qua bám da trong bề rộng B;
 * khi lệch ra ngoài đầu → phóng dài chồng lên dầm lệch.
 */
import { createSampleS1 } from "../lib/sample";
import {
  applyAxesToProject,
  beamsFromAxes,
  beamSegments,
  beamSegSideFaces,
  patchBeamSelectedSegShiftsContinuous,
} from "../lib/grid";
import { uid } from "../lib/utils";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let p = createSampleS1();
// Lưới 3 trục đứng × 4 trục ngang (như hình A–D / 1–3)
p = {
  ...p,
  axesX: [
    { id: uid("ax"), name: "1", pos: 0 },
    { id: uid("ax"), name: "2", pos: 3000 },
    { id: uid("ax"), name: "3", pos: 6000 },
  ],
  axesY: [
    { id: uid("ay"), name: "A", pos: 0 },
    { id: uid("ay"), name: "B", pos: 1500 },
    { id: uid("ay"), name: "C", pos: 3000 },
    { id: uid("ay"), name: "D", pos: 4500 },
  ],
};
p = applyAxesToProject({ ...p, beams: beamsFromAxes(p) });

const vertMid = (p.beams ?? []).find((b) => b.direction === "Y" && Math.abs(b.axis - 3000) < 1);
assert(vertMid, "need mid vertical beam on axis 2");
const horizB = (p.beams ?? []).find((b) => b.direction === "X" && Math.abs(b.axis - 1500) < 1);
assert(horizB, `need horizontal beam on B, have ${(p.beams ?? []).map((b) => b.direction + "@" + b.axis).join(",")}`);

const segsBefore = beamSegments(p, horizB!);
assert(segsBefore.length === 2, `horiz should have 2 segs, got ${segsBefore.length}`);
const left0 = segsBefore[0];
const right0 = segsBefore[1];
// Chưa lệch: hai đoạn cắt nhau trong B tại trục 2
assert(left0.hi > right0.lo, `overlap before: left.hi=${left0.hi} right.lo=${right0.lo}`);
const overlap0 = left0.hi - right0.lo;
assert(Math.abs(overlap0 - 220) < 1.5, `overlap before want B=220 got ${overlap0}`);

// Lệch dầm giữa xéo s0=200 s1=600 suốt thanh
const vSegs = beamSegments(p, vertMid!);
p = patchBeamSelectedSegShiftsContinuous(
  p,
  vSegs.map((s) => ({ beamId: vertMid!.id, segIndex: s.index })),
  { s0: 200, s1: 600 },
);

const horiz = (p.beams ?? []).find((b) => b.id === horizB!.id)!;
const segs = beamSegments(p, horiz);
assert(segs.length === 2, `after skew still 2 segs, got ${segs.length}`);

const left = segs[0];
const right = segs[1];
const overlap = left.hi - right.lo;
console.log({
  left: { lo: left.lo, hi: left.hi },
  right: { lo: right.lo, hi: right.hi },
  overlap,
});

assert(overlap > 100, `overlap within skewed B, got ${overlap}`);
assert(Math.abs(overlap - 220) < 2, `overlap should ≈ B=220, got ${overlap}`);
// Khớp lệch: joint đã dịch sang phải so với trước
assert(left.hi > left0.hi + 100, `left.hi should extend right after skew: ${left.hi} vs ${left0.hi}`);
assert(right.lo > right0.lo + 100, `right.lo should move right: ${right.lo} vs ${right0.lo}`);

// --- Case 2: dầm biên lệch ra ngoài → phóng dài đoạn ngoài cùng ---
let p2 = createSampleS1();
p2 = {
  ...p2,
  axesX: [
    { id: uid("ax"), name: "1", pos: 0 },
    { id: uid("ax"), name: "2", pos: 3000 },
    { id: uid("ax"), name: "3", pos: 6000 },
    { id: uid("ax"), name: "4", pos: 9000 },
  ],
  axesY: [
    { id: uid("ay"), name: "A", pos: 0 },
    { id: uid("ay"), name: "B", pos: 2000 },
    { id: uid("ay"), name: "C", pos: 4000 },
  ],
};
p2 = applyAxesToProject({ ...p2, beams: beamsFromAxes(p2) });

const edge = (p2.beams ?? []).find((b) => b.direction === "Y" && Math.abs(b.axis - 9000) < 1);
assert(edge, "need edge beam on axis 4");
const hA = (p2.beams ?? []).find((b) => b.direction === "X" && Math.abs(b.axis - 0) < 1);
assert(hA, "need bottom horizontal");

const beforeEdge = beamSegments(p2, hA!);
const lastBefore = beforeEdge[beforeEdge.length - 1];
assert(lastBefore, "need last horiz seg");

const eSegs = beamSegments(p2, edge!);
p2 = patchBeamSelectedSegShiftsContinuous(
  p2,
  eSegs.map((s) => ({ beamId: edge!.id, segIndex: s.index })),
  { s0: 500, s1: 200 }, // lệch ra ngoài (+X), xéo
);

const hA2 = (p2.beams ?? []).find((b) => b.id === hA!.id)!;
const afterEdge = beamSegments(p2, hA2);
const lastAfter = afterEdge[afterEdge.length - 1];
console.log({
  lastBeforeHi: lastBefore.hi,
  lastAfterHi: lastAfter.hi,
  delta: lastAfter.hi - lastBefore.hi,
});

assert(
  lastAfter.hi > lastBefore.hi + 150,
  `edge horiz should extend outward: ${lastAfter.hi} vs ${lastBefore.hi}`,
);

// Chồng lên dầm lệch: hi đoạn ngang = da ngoài (hi) của dầm biên tại Y=A
const edge2 = (p2.beams ?? []).find((b) => b.id === edge!.id)!;
const edgeFaces = beamSegSideFaces(edge2, 0); // tại đầu A
assert(
  Math.abs(lastAfter.hi - edgeFaces.hi0) < 2,
  `last.hi should match edge outer hi0=${edgeFaces.hi0}, got ${lastAfter.hi}`,
);

console.log("OK skew split + extend");
