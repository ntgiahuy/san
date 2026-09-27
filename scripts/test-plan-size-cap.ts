import assert from "node:assert/strict";
import {
  MAX_PLAN_AREA_MM2,
  MAX_PLAN_SIZE_MM,
  clampPlanSizeMm,
  rebarStationsAlong,
  setPlanSize,
  stripRebarBarSegments,
} from "../lib/grid";
import { createSampleS1 } from "../lib/sample";
import { normalizeProject } from "../lib/calc";

assert.equal(clampPlanSizeMm(200_000), MAX_PLAN_SIZE_MM);
assert.equal(clampPlanSizeMm(50), 500);
assert.equal(clampPlanSizeMm(6000), 6000);

const sample = createSampleS1();
const wide = setPlanSize(sample, 200_000, sample.planHeight);
assert.equal(wide.planWidth, MAX_PLAN_SIZE_MM);
assert.equal(wide.planHeight, sample.planHeight);

const both = setPlanSize(sample, 200_000, 250_000);
assert.ok(both.planWidth * both.planHeight <= MAX_PLAN_AREA_MM2 + 1);
assert.ok(both.planWidth <= MAX_PLAN_SIZE_MM);
assert.ok(both.planHeight <= MAX_PLAN_SIZE_MM);

const fromFile = normalizeProject({
  ...sample,
  planWidth: 500_000,
  planHeight: sample.planHeight,
} as typeof sample);
assert.equal(fromFile.planWidth, MAX_PLAN_SIZE_MM);

const stations = rebarStationsAlong(0, 1_000_000, 50);
assert.ok(stations.length <= Math.ceil(MAX_PLAN_SIZE_MM / 50));

const t0 = Date.now();
const bars = stripRebarBarSegments(wide, wide.axesX, wide.axesY);
const ms = Date.now() - t0;
assert.ok(ms < 3000, `stripRebar too slow: ${ms}ms bars=${bars.length}`);

const t1 = Date.now();
const barsBoth = stripRebarBarSegments(both, both.axesX, both.axesY);
const msBoth = Date.now() - t1;
assert.ok(msBoth < 5000, `stripRebar(both) too slow: ${msBoth}ms`);

console.log("ok", {
  MAX_PLAN_SIZE_MM,
  wideBars: bars.length,
  wideMs: ms,
  both: { W: both.planWidth, H: both.planHeight, bars: barsBoth.length, ms: msBoth },
  stations: stations.length,
});
