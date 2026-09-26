/**
 * PDF section proof: rebar through beams + hooks at edge/opening/cut-low.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { generateSlabPdf } from "../lib/pdf/generate";
import { createSampleS1 } from "../lib/sample";
import {
  sortAxes, baySlabExtent, ensureSectionCuts, applyAxisCount, ensureBeamsSplitBays,
  findBeamOnAxis,
} from "../lib/grid";
import { uid } from "../lib/utils";
import type { PlanBeam, SlabProject } from "../lib/types";

async function main() {
  const xs = [0, 3700, 8000, 12300];
  const ys = [0, 3750, 7500, 11250, 15000];
  const axesX = xs.map((pos, i) => ({ id: uid("ax"), name: String(i + 1), pos }));
  const axesY = ys.map((pos, i) => ({ id: uid("ay"), name: String.fromCharCode(65 + i), pos }));
  const beams: PlanBeam[] = [];
  for (const a of axesX) {
    beams.push({
      id: uid("bm"), name: `D${a.name}`, direction: "Y", axis: a.pos, axisId: a.id,
      start: 0, end: 15000, size: "200x500", offset: 0,
    });
  }
  for (const a of axesY) {
    beams.push({
      id: uid("bm"), name: `D${a.name}`, direction: "X", axis: a.pos, axisId: a.id,
      start: 0, end: 12300, size: "200x500", offset: 0,
    });
  }
  let project: SlabProject = {
    ...createSampleS1(),
    planWidth: 12300,
    planHeight: 15000,
    axesX,
    axesY,
    beams,
    info: { ...createSampleS1().info, showDistRange: true, cover: 25 },
  };
  project = ensureBeamsSplitBays(project);
  const ax = sortAxes(project.axesX!);
  const ay = sortAxes(project.axesY!);
  // Low cut at 3-4/B-C (like user hatch), opening at 1-2/C-D
  const lowE = baySlabExtent(project, ax, ay, 2, 1);
  const o1 = baySlabExtent(project, ax, ay, 0, 2);
  project.lowSlabs = [{
    id: uid("ls"), name: "ST1", x: lowE.x0, y: lowE.y0,
    w: lowE.x1 - lowE.x0, h: lowE.y1 - lowE.y0, drop: 50, rebarMode: "cut",
  }];
  project.openings = [{
    id: uid("op"), name: "O1", x: o1.x0, y: o1.y0, w: o1.x1 - o1.x0, h: o1.y1 - o1.y0,
  }];
  // Cut A-A along X near mid of first column; B-B along Y near mid of B-C
  project.sections = ensureSectionCuts({
    ...project,
    sections: [
      {
        id: uid("sec"), name: "1", textHeight: 150, direction: "X",
        at: 1850, from: 0, to: project.planHeight, axisId: ax[0]?.id, offsetMm: 1850,
      },
      {
        id: uid("sec"), name: "1", textHeight: 150, direction: "Y",
        at: 5600, from: 0, to: project.planWidth, axisId: ay[1]?.id, offsetMm: 1850,
      },
    ],
  });

  const root = resolve(__dirname, "..");
  const regular = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Regular.ttf"));
  const bold = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Bold.ttf"));
  const bytes = await generateSlabPdf(project, {
    regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
    bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
  });
  const outDir = resolve(root, "docs");
  mkdirSync(outDir, { recursive: true });
  const pdfPath = resolve(outDir, "section-rebar-through.pdf");
  writeFileSync(pdfPath, bytes);

  console.log("wrote", pdfPath);
}
main().catch((e) => { console.error(e); process.exit(1); });
