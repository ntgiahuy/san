import { createSampleS1 } from "./lib/sample";
import { ensureSectionCuts, sectionCutAtMm, sortAxes, applyAxisCount } from "./lib/grid";

let p = createSampleS1();
p = applyAxisCount({ ...p, planWidth: 17000, planHeight: 15000 }, "X", 5);
p = applyAxisCount({ ...p, planWidth: 17000, planHeight: 15000 }, "Y", 5);
const secs = ensureSectionCuts(p);
const sx = secs.find((s) => s.direction === "X")!;
const sy = secs.find((s) => s.direction === "Y")!;
const ax = sortAxes(p.axesX);
const ay = sortAxes(p.axesY);

const sx2 = { ...sx, axisId: ax[1]!.id, offsetMm: 250 };
const atX = sectionCutAtMm(p, sx2);
const sy2 = { ...sy, axisId: ay[2]!.id, offsetMm: -100 };
const atY = sectionCutAtMm(p, sy2);

const pass =
  secs.length === 2 &&
  !!sx.axisId &&
  !!sy.axisId &&
  atX === ax[1]!.pos + 250 &&
  atY === ay[2]!.pos - 100 &&
  ax.every((a) => a.name) &&
  ay.every((a) => a.name);

console.log(pass ? "PASS section axis+offset" : "FAIL", {
  atX,
  expectX: ax[1]!.pos + 250,
  atY,
  expectY: ay[2]!.pos - 100,
  namesX: ax.map((a) => a.name),
  namesY: ay.map((a) => a.name),
});
process.exit(pass ? 0 : 1);
