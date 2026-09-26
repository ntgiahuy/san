import { createSampleS1 } from "./lib/sample";
import { effectiveZones } from "./lib/calc";
import { applyAxesToProject, setAxisCount } from "./lib/grid";

let p = createSampleS1();
p = applyAxesToProject({
  ...p,
  layoutPreset: "economy2",
  planWidth: 17000,
  planHeight: 15000,
  axesX: setAxisCount(p.axesX, 5, 17000, "X"),
  axesY: setAxisCount(p.axesY, 5, 15000, "Y"),
  economy2: { ...p.economy2, distToCenter: 3, hatAlongShort: true },
});

const zones = effectiveZones(p);
const hats = zones.filter((z) => z.layer === "top");
const hatX = hats.filter((z) => z.direction === "X");
const hatY = hats.filter((z) => z.direction === "Y");
const hasCheckboxStrings = false; // UI check separate

const pass = hatX.length >= 2 && hatY.length >= 2;
console.log(
  pass ? "PASS economy2 hats X+Y" : "FAIL",
  { hatX: hatX.length, hatY: hatY.length, notes: [...new Set(hats.map((h) => h.note))] },
);
process.exit(pass ? 0 : 1);
