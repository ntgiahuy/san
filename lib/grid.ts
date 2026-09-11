import type { GridAxis, PlanBeam, SlabProject } from "./types";
import { uid } from "./utils";

function halfB(size: string): number {
  const m = size.trim().toLowerCase().match(/^(\d+)\s*[x×]/);
  return m ? Math.round(Number(m[1]) / 2) : 110;
}

/** Tên trục X tiếp theo: 1,2,3… */
export function nextAxisNameX(axes: GridAxis[]): string {
  const nums = axes
    .map((a) => Number.parseInt(a.name, 10))
    .filter((n) => Number.isFinite(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

/** Tên trục Y tiếp theo: A,B,…Z,AA… */
export function nextAxisNameY(axes: GridAxis[]): string {
  const toNum = (s: string) => {
    const t = s.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(t)) return 0;
    let n = 0;
    for (const ch of t) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  };
  const fromNum = (n: number) => {
    let x = Math.max(1, n);
    let out = "";
    while (x > 0) {
      const r = (x - 1) % 26;
      out = String.fromCharCode(65 + r) + out;
      x = Math.floor((x - 1) / 26);
    }
    return out;
  };
  const nums = axes.map((a) => toNum(a.name)).filter((n) => n > 0);
  return fromNum((nums.length ? Math.max(...nums) : 0) + 1);
}

export function sortAxes(axes: GridAxis[]): GridAxis[] {
  return [...axes].sort((a, b) => a.pos - b.pos);
}

export function defaultAxesX(width = 6000): GridAxis[] {
  const mid = Math.round(width / 2);
  return [
    { id: uid("ax"), name: "1", pos: 0 },
    { id: uid("ax"), name: "2", pos: mid },
    { id: uid("ax"), name: "3", pos: width },
  ];
}

export function defaultAxesY(height = 4500): GridAxis[] {
  return [
    { id: uid("ay"), name: "A", pos: 0 },
    { id: uid("ay"), name: "B", pos: height },
  ];
}

export function planSizeFromAxes(axesX: GridAxis[], axesY: GridAxis[]) {
  const xs = sortAxes(axesX);
  const ys = sortAxes(axesY);
  return {
    planWidth: xs.length ? xs[xs.length - 1].pos : 0,
    planHeight: ys.length ? ys[ys.length - 1].pos : 0,
  };
}

/** Khoảng cách nhịp giữa trục (i-1) và i (i=0 → vị trí gốc). */
export function axisSpan(axes: GridAxis[], index: number): number {
  const sorted = sortAxes(axes);
  if (index <= 0) return sorted[0]?.pos ?? 0;
  return Math.max(0, sorted[index].pos - sorted[index - 1].pos);
}

export function renameAxis(axes: GridAxis[], id: string, name: string): GridAxis[] {
  return axes.map((a) => (a.id === id ? { ...a, name } : a));
}

export function removeAxis(axes: GridAxis[], id: string): GridAxis[] {
  const next = sortAxes(axes.filter((a) => a.id !== id));
  return next.length >= 2 ? next : axes;
}

export function setAxisSpan(axes: GridAxis[], index: number, spanMm: number): GridAxis[] {
  const sorted = sortAxes(axes);
  if (index <= 0 || index >= sorted.length) return sorted;
  const span = Math.max(0, spanMm);
  const delta = span - (sorted[index].pos - sorted[index - 1].pos);
  return sorted.map((a, i) => (i >= index ? { ...a, pos: a.pos + delta } : a));
}

export function beamsFromAxes(project: SlabProject): PlanBeam[] {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const { planWidth: W, planHeight: H } = planSizeFromAxes(axesX, axesY);
  const prefix = project.info.beamNamePrefix || "D";
  const sizeX = project.info.beamSizeX;
  const sizeY = project.info.beamSizeY;
  const beams: PlanBeam[] = [];
  let n = 1;
  for (const ax of axesX) {
    beams.push({
      id: uid("beam"),
      name: `${prefix}${n++}`,
      size: sizeX,
      direction: "Y",
      axis: ax.pos,
      start: 0,
      end: H,
      offset: halfB(sizeX),
    });
  }
  for (const ay of axesY) {
    beams.push({
      id: uid("beam"),
      name: `${prefix}${n++}`,
      size: sizeY,
      direction: "X",
      axis: ay.pos,
      start: 0,
      end: W,
      offset: halfB(sizeY),
    });
  }
  return beams;
}

export function ensureAxes(project: SlabProject): SlabProject {
  const axesX =
    project.axesX && project.axesX.length >= 2
      ? sortAxes(project.axesX)
      : defaultAxesX(project.planWidth || 6000);
  const axesY =
    project.axesY && project.axesY.length >= 2
      ? sortAxes(project.axesY)
      : defaultAxesY(project.planHeight || 4500);
  const size = planSizeFromAxes(axesX, axesY);
  return { ...project, axesX, axesY, ...size };
}

export function applyAxesToProject(project: SlabProject): SlabProject {
  const withAxes = ensureAxes(project);
  const size = planSizeFromAxes(withAxes.axesX, withAxes.axesY);
  const next = { ...withAxes, ...size };
  return { ...next, beams: beamsFromAxes(next) };
}

/** Chèn thêm ô sàn theo phương X (thêm trục 1,2,3…). */
export function insertSlabBayX(project: SlabProject, spanMm = 3000): SlabProject {
  const base = ensureAxes(project);
  const axesX = sortAxes(base.axesX);
  const last = axesX[axesX.length - 1];
  const nextX = [
    ...axesX,
    {
      id: uid("ax"),
      name: nextAxisNameX(axesX),
      pos: (last?.pos ?? 0) + Math.max(500, spanMm),
    },
  ];
  return applyAxesToProject({ ...base, axesX: nextX });
}

/** Chèn thêm ô sàn theo phương Y (thêm trục A,B,C…). */
export function insertSlabBayY(project: SlabProject, spanMm = 3000): SlabProject {
  const base = ensureAxes(project);
  const axesY = sortAxes(base.axesY);
  const last = axesY[axesY.length - 1];
  const nextY = [
    ...axesY,
    {
      id: uid("ay"),
      name: nextAxisNameY(axesY),
      pos: (last?.pos ?? 0) + Math.max(500, spanMm),
    },
  ];
  return applyAxesToProject({ ...base, axesY: nextY });
}
