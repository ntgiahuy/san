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
import { normalizeProject, computeModel } from "../lib/calc";

assert.equal(clampPlanSizeMm(200_000), MAX_PLAN_SIZE_MM);
assert.equal(clampPlanSizeMm(50), 500);
assert.equal(clampPlanSizeMm(6000), 6000);
assert.equal(MAX_PLAN_SIZE_MM, 50_000);

const sample = createSampleS1();
const wide = setPlanSize(sample, 40_000, sample.planHeight);
assert.equal(wide.planWidth, 40_000);

const capped = setPlanSize(sample, 80_000, sample.planHeight);
assert.equal(capped.planWidth, MAX_PLAN_SIZE_MM);

const both = setPlanSize(sample, 40_000, 50_000);
assert.ok(both.planWidth * both.planHeight <= MAX_PLAN_AREA_MM2 + 1);

const fromFile = normalizeProject({
  ...sample,
  planWidth: 500_000,
  planHeight: sample.planHeight,
} as typeof sample);
assert.equal(fromFile.planWidth, MAX_PLAN_SIZE_MM);

const stations = rebarStationsAlong(0, 1_000_000, 50);
assert.ok(stations.length <= Math.ceil(MAX_PLAN_SIZE_MM / 50));

const t0 = Date.now();
computeModel(wide);
stripRebarBarSegments(wide, wide.axesX, wide.axesY);
const ms = Date.now() - t0;
assert.ok(ms < 800, `40m wide too slow: ${ms}ms`);

const t1 = Date.now();
computeModel(both);
stripRebarBarSegments(both, both.axesX, both.axesY);
const msBoth = Date.now() - t1;
assert.ok(msBoth < 1200, `area-capped both too slow: ${msBoth}ms`);

console.log("ok", {
  MAX_PLAN_SIZE_MM,
  MAX_PLAN_AREA_MM2,
  wideMs: ms,
  both: { W: both.planWidth, H: both.planHeight, ms: msBoth },
});
