/**
 * Chọn nhiều đoạn + Dịch đầu/cuối → một đường xéo thẳng (nội suy), không từng đoạn riêng.
 */
import { createSampleS1 } from "../lib/sample";
import {
  applyAxesToProject,
  getBeamSegShift,
  patchBeamSelectedSegShiftsContinuous,
  beamSegments,
} from "../lib/grid";
import { uid } from "../lib/utils";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let p = createSampleS1();
// Ép lưới 1 cột × 3 nhịp dọc
p = applyAxesToProject({
  ...p,
  axesX: [
    { id: uid("ax"), name: "1", pos: 0 },
    { id: uid("ax"), name: "2", pos: 3000 },
  ],
  axesY: [
    { id: uid("ay"), name: "A", pos: 0 },
    { id: uid("ay"), name: "B", pos: 1500 },
    { id: uid("ay"), name: "C", pos: 3000 },
    { id: uid("ay"), name: "D", pos: 4500 },
  ],
});
const vert = (p.beams ?? []).find((b) => b.direction === "Y" && !b.free);
assert(vert, `need vertical beam, have ${(p.beams ?? []).map((b) => b.direction + (b.free ? "f" : "")).join(",")}`);
const segs = beamSegments(p, vert!);
assert(segs.length >= 3, `want >=3 segs got ${segs.length}`);
const beamId = vert!.id;

p = patchBeamSelectedSegShiftsContinuous(
  p,
  [
    { beamId, segIndex: 0 },
    { beamId, segIndex: 1 },
    { beamId, segIndex: 2 },
  ],
  { s0: 300, s1: 0 },
);

const b = (p.beams ?? []).find((x) => x.id === beamId)!;
const s0 = getBeamSegShift(b, 0);
const s1 = getBeamSegShift(b, 1);
const s2 = getBeamSegShift(b, 2);
console.log({ s0, s1, s2, nSeg: segs.length });

assert(s0.s0 === 300, `seg0.s0 want 300 got ${s0.s0}`);
assert(s2.s1 === 0, `seg2.s1 want 0 got ${s2.s1}`);
assert(s0.s1 === s1.s0, `joint B: ${s0.s1} vs ${s1.s0}`);
assert(s1.s1 === s2.s0, `joint C: ${s1.s1} vs ${s2.s0}`);
assert(s0.s1 === 200, `at B want 200 got ${s0.s1}`);
assert(s1.s1 === 100, `at C want 100 got ${s1.s1}`);

console.log("OK continuous skew");
