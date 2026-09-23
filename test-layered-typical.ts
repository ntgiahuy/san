import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import {
  sortAxes,
  stripRebarBarSegments,
  typicalLayeredRebarBars,
  bottomUnderDir,
  slabLayerPlanGapMm,
  slabLayerPlanVisualGapMm,
  applyAxesToProject,
  setAxisCount,
} from "./lib/grid";

let p = createSampleS1();
p = applyAxesToProject({
  ...p,
  info: { ...p.info, thickness: 120, cover: 25, name: "Sàn S1" },
  planWidth: 20000,
  planHeight: 16000,
  axesX: setAxisCount(p.axesX, 5, 20000, "X"),
  axesY: setAxisCount(p.axesY, 4, 16000, "Y"),
  layoutPreset: "simple2",
});

const zones = effectiveZones(p);
const axesX = sortAxes(p.axesX);
const axesY = sortAxes(p.axesY);
const bars = stripRebarBarSegments(p, axesX, axesY);
const layered = typicalLayeredRebarBars(p, bars, zones);

const eng = slabLayerPlanGapMm(p);
const vis = slabLayerPlanVisualGapMm(p);
const under = bottomUnderDir(p);

const xBars = layered.filter((b) => b.dir === "X");
const yBars = layered.filter((b) => b.dir === "Y");
const botX = xBars.find((b) => b.layer === "bottom");
const topX = xBars.find((b) => b.layer === "top");
const botY = yBars.find((b) => b.layer === "bottom");
const topY = yBars.find((b) => b.layer === "top");

const xSep =
  botX && topX && botX.dir === "X" && topX.dir === "X"
    ? Math.abs(topX.y - botX.y)
    : null;
const ySep =
  botY && topY && botY.dir === "Y" && topY.dir === "Y"
    ? Math.abs(topY.x - botY.x)
    : null;

console.log({ eng, vis, under, xSep, ySep, drawOrder: layered.map((b) => `${b.layer}:${b.dir}`) });

// 5 trục X → 4 dải Y; 4 trục Y → 3 dải X; mỗi dải × 2 lớp (bot+top)
const pass =
  xBars.filter((b) => b.layer === "bottom").length === 3 &&
  yBars.filter((b) => b.layer === "bottom").length === 4 &&
  eng === 95 &&
  vis >= 600 &&
  xSep !== null &&
  Math.abs(xSep - vis) < 0.01 &&
  ySep !== null &&
  Math.abs(ySep - vis) < 0.01 &&
  layered[0]!.layer === "bottom" &&
  layered[0]!.dir === "Y";

console.log(pass ? "PASS visual sep" : "FAIL");
process.exit(pass ? 0 : 1);
