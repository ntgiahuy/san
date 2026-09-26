/**
 * Visual proof: dist ranges stop at openings (layout like user screenshot).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createSampleS1 } from "../lib/sample";
import { effectiveZones } from "../lib/calc";
import {
  sortAxes, stripRebarBarSegments, typicalLayeredRebarBars, baySlabExtent,
  ensureBeamsSplitBays, buildMergedDistRanges, rebarBarStraightLenMm,
  hooksForRebarBar, distRangeJunctionsOnBars, rectOpeningDiagonals,
  rectDiagonalHatchSegments,
} from "../lib/grid";
import { uid } from "../lib/utils";
import type { PlanBeam, SlabProject } from "../lib/types";
import { chromium } from "playwright";

function buildProject(): SlabProject {
  const xs = [0, 3700, 8000, 12300];
  const ys = [0, 3750, 7500, 11250, 15000];
  const axesX = xs.map((pos, i) => ({ id: uid("ax"), name: String(i + 1), pos }));
  const axesY = ys.map((pos, i) => ({ id: uid("ay"), name: String.fromCharCode(65 + i), pos }));
  const beams: PlanBeam[] = [];
  for (const a of axesX) {
    beams.push({ id: uid("bm"), name: `D${a.name}`, direction: "Y", axis: a.pos, axisId: a.id, start: 0, end: 15000, size: "200x400", offset: 0 });
  }
  for (const a of axesY) {
    beams.push({ id: uid("bm"), name: `D${a.name}`, direction: "X", axis: a.pos, axisId: a.id, start: 0, end: 12300, size: "200x400", offset: 0 });
  }
  let p = createSampleS1();
  p = { ...p, planWidth: 12300, planHeight: 15000, axesX, axesY, beams, info: { ...p.info, showDistRange: true } };
  p = ensureBeamsSplitBays(p);
  const ax = sortAxes(p.axesX!);
  const ay = sortAxes(p.axesY!);
  const o1 = baySlabExtent(p, ax, ay, 0, 2);
  const o2 = baySlabExtent(p, ax, ay, 1, 1);
  const lowE = baySlabExtent(p, ax, ay, 2, 1);
  p.openings = [
    { id: "op1", name: "O1", x: o1.x0, y: o1.y0, w: o1.x1 - o1.x0, h: o1.y1 - o1.y0 },
    { id: "op2", name: "O2", x: o2.x0, y: o2.y0, w: o2.x1 - o2.x0, h: o2.y1 - o2.y0 },
  ];
  p.lowSlabs = [{ id: "ls1", name: "ST1", x: lowE.x0, y: lowE.y0, w: lowE.x1 - lowE.x0, h: lowE.y1 - lowE.y0, drop: 50, rebarMode: "cut" }];
  return p;
}

async function main() {
  const p = buildProject();
  const ax = sortAxes(p.axesX!);
  const ay = sortAxes(p.axesY!);
  const zones = effectiveZones(p);
  const bars = stripRebarBarSegments(p, ax, ay);
  const drawBars = typicalLayeredRebarBars(p, bars, zones);
  const markKeyOf = (bar: (typeof bars)[number]) => {
    const mx = bar.dir === "X" ? (bar.x0 + bar.x1) / 2 : bar.x;
    const my = bar.dir === "X" ? bar.y : (bar.y0 + bar.y1) / 2;
    const hits = zones.filter((z) => {
      if (z.direction !== bar.dir) return false;
      const zx0 = Math.min(z.x1, z.x2), zx1 = Math.max(z.x1, z.x2);
      const zy0 = Math.min(z.y1, z.y2), zy1 = Math.max(z.y1, z.y2);
      return mx >= zx0 - 1 && mx <= zx1 + 1 && my >= zy0 - 1 && my <= zy1 + 1;
    });
    const z = hits.find((h) => h.layer === "bottom") ?? hits[0];
    const hooks = hooksForRebarBar(p, bar, zones);
    const len = Math.round(rebarBarStraightLenMm(bar) + hooks.left + hooks.right);
    return z ? `${z.mark}|${z.dia}|${z.spacing}|${z.direction}|L${len}|H${hooks.left}/${hooks.right}` : `${bar.dir}|L${len}`;
  };
  const merged = buildMergedDistRanges(p, ax, ay, bars, markKeyOf, undefined, zones);

  const W = 1100, H = 980, pad = 48;
  const s = Math.min((W - 2 * pad) / p.planWidth, (H - 2 * pad) / p.planHeight);
  const X = (mm: number) => pad + mm * s;
  const Y = (mm: number) => H - pad - mm * s;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  parts.push(`<rect width="100%" height="100%" fill="#0b1220"/>`);

  for (const ls of p.lowSlabs ?? []) {
    parts.push(`<rect x="${X(ls.x)}" y="${Y(ls.y+ls.h)}" width="${ls.w*s}" height="${ls.h*s}" fill="#334155" fill-opacity="0.35" stroke="#94a3b8"/>`);
    for (const h of rectDiagonalHatchSegments(ls.x, ls.y, ls.x+ls.w, ls.y+ls.h, 350)) {
      parts.push(`<line x1="${X(h.xA)}" y1="${Y(h.yA)}" x2="${X(h.xB)}" y2="${Y(h.yB)}" stroke="#94a3b8" stroke-width="0.8"/>`);
    }
  }
  for (const op of p.openings ?? []) {
    parts.push(`<rect x="${X(op.x)}" y="${Y(op.y+op.h)}" width="${op.w*s}" height="${op.h*s}" fill="#111827" stroke="#f87171" stroke-dasharray="4 3"/>`);
    for (const d of rectOpeningDiagonals(op.x, op.y, op.x+op.w, op.y+op.h)) {
      parts.push(`<line x1="${X(d.xA)}" y1="${Y(d.yA)}" x2="${X(d.xB)}" y2="${Y(d.yB)}" stroke="#f87171" stroke-width="1.2" stroke-dasharray="6 4"/>`);
    }
    parts.push(`<text x="${X(op.x+op.w/2)}" y="${Y(op.y+op.h/2)}" fill="#fca5a5" font-size="14" text-anchor="middle">${op.name}</text>`);
  }
  for (const a of ax) parts.push(`<line x1="${X(a.pos)}" y1="${Y(0)}" x2="${X(a.pos)}" y2="${Y(p.planHeight)}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>`);
  for (const a of ay) parts.push(`<line x1="${X(0)}" y1="${Y(a.pos)}" x2="${X(p.planWidth)}" y2="${Y(a.pos)}" stroke="#475569" stroke-width="1" stroke-dasharray="4 3"/>`);

  for (const bar of drawBars) {
    const stroke = bar.layer === "top" ? "#f87171" : "#ef4444";
    if (bar.dir === "X") parts.push(`<line x1="${X(bar.x0)}" y1="${Y(bar.y)}" x2="${X(bar.x1)}" y2="${Y(bar.y)}" stroke="${stroke}" stroke-width="1.6"/>`);
    else parts.push(`<line x1="${X(bar.x)}" y1="${Y(bar.y0)}" x2="${X(bar.x)}" y2="${Y(bar.y1)}" stroke="${stroke}" stroke-width="1.6"/>`);
  }
  for (const seg of merged) {
    parts.push(`<line x1="${X(seg.xA)}" y1="${Y(seg.yA)}" x2="${X(seg.xB)}" y2="${Y(seg.yB)}" stroke="#2563eb" stroke-width="1.6"/>`);
    const midX = (X(seg.xA)+X(seg.xB))/2, midY = (Y(seg.yA)+Y(seg.yB))/2;
    parts.push(`<text x="${midX}" y="${midY-6}" fill="#60a5fa" font-size="11" text-anchor="middle">${Math.round(seg.lenMm)}</text>`);
    for (const j of distRangeJunctionsOnBars(seg, drawBars)) {
      parts.push(`<circle cx="${X(j.x)}" cy="${Y(j.y)}" r="3.5" fill="none" stroke="#fff" stroke-width="1.2"/>`);
    }
  }
  parts.push(`</svg>`);
  const outDir = resolve("docs");
  mkdirSync(outDir, { recursive: true });
  const svgPath = resolve(outDir, "dist-skip-opening.svg");
  writeFileSync(svgPath, parts.join("\n"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto("file://" + svgPath);
  const png = resolve(outDir, "dist-skip-opening.png");
  await page.screenshot({ path: png });
  await browser.close();
  console.log("wrote", png, "merged", merged.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
