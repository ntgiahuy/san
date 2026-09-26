/**
 * Sàn thấp nhấn: ký hiệu ↓drop chỉ trên cây điển hình (không chồng mọi a=…).
 */
import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  applyAxesToProject,
  ensureBeamsSplitBays,
  baySlabExtent,
  stripRebarPressMarks,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  formatBeamSize,
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
// Đủ dầm quanh ô — giống mặt bằng thật
{
  const size = formatBeamSize(p.info.beamB || 220, p.info.beamH || 500);
  const ax0 = sortAxes(p.axesX ?? []);
  const ay0 = sortAxes(p.axesY ?? []);
  const beams = [...(p.beams ?? [])];
  for (const a of ax0) {
    if (!beams.some((b) => b.direction === "Y" && Math.abs(b.axis - a.pos) < 0.5)) {
      beams.push({
        id: uid("b"),
        name: `D${a.name}`,
        direction: "Y",
        axis: a.pos,
        axisId: a.id,
        size,
        offset: 110,
        start: 0,
        end: p.planHeight,
      });
    }
  }
  for (const a of ay0) {
    if (!beams.some((b) => b.direction === "X" && Math.abs(b.axis - a.pos) < 0.5)) {
      beams.push({
        id: uid("b"),
        name: `D${a.name}`,
        direction: "X",
        axis: a.pos,
        axisId: a.id,
        size,
        offset: 110,
        start: 0,
        end: p.planWidth,
      });
    }
  }
  p = { ...p, beams };
  p = ensureBeamsSplitBays(p);
}
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
    drop: 200,
    rebarMode: "press",
  },
];

const zones = effectiveZones(p);
const allBars = stripRebarBarSegments(p, ax, ay);
const drawBars = typicalLayeredRebarBars(p, allBars, zones);
const marks = stripRebarPressMarks(p, ax, ay, zones);

// Trước đây hàng chục marks (mọi thanh a → chồng ↓200); giờ chỉ trên điển hình (~8 với 4 cạnh).
const maxOk = 16;
const minOk = 4;
let ok = marks.length >= minOk && marks.length <= maxOk;
if (marks.length > 20) {
  console.log("FAIL still too many press marks (looks like all-spacing)", marks.length);
  ok = false;
}

// Mỗi mark phải nằm trên một cây điển hình
for (const m of marks) {
  const onTypical = drawBars.some((b) => {
    if (m.dir === "X" && b.dir === "X") {
      return Math.abs(b.y - m.y) < 1.5 && Math.min(b.x0, b.x1) <= m.x + 1 && Math.max(b.x0, b.x1) >= m.x - 1;
    }
    if (m.dir === "Y" && b.dir === "Y") {
      return Math.abs(b.x - m.x) < 1.5 && Math.min(b.y0, b.y1) <= m.y + 1 && Math.max(b.y0, b.y1) >= m.y - 1;
    }
    return false;
  });
  if (!onTypical) {
    console.log("FAIL mark not on typical", m);
    ok = false;
  }
  if (m.drop !== 200) {
    console.log("FAIL drop", m.drop);
    ok = false;
  }
}

console.log(ok ? "PASS low-slab press marks on typical only" : "FAIL", {
  marks: marks.length,
  drawBars: drawBars.length,
  allBars: allBars.length,
  maxOk,
});
process.exit(ok ? 0 : 1);
