import type { GridAxis, PlanBeam, SlabInfo, SlabProject } from "./types";
import { uid } from "./utils";

export function formatBeamSize(b: number, h: number): string {
  return `${Math.max(1, Math.round(b))}x${Math.max(1, Math.round(h))}`;
}

/** Đọc B / H / B1 từ info (kèm fallback chuỗi beamSize cũ). */
export function beamDims(info: SlabInfo): { B: number; H: number; B1: number } {
  const fromStr = (size?: string) => {
    const m = (size ?? "").trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
    return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
  };
  const parsed = fromStr(info.beamSizeX || info.beamSizeY);
  const B = Number.isFinite(info.beamB) && info.beamB > 0 ? info.beamB : parsed.b;
  const H = Number.isFinite(info.beamH) && info.beamH > 0 ? info.beamH : parsed.h;
  const B1 =
    Number.isFinite(info.beamB1) && info.beamB1 >= 0 ? info.beamB1 : Math.round(B / 2);
  return { B, H, B1 };
}

/** Đồng bộ beamSizeX/Y + counts từ trục / kích thước số. */
export function syncBeamInfo(info: SlabInfo, axesXLen?: number, axesYLen?: number): SlabInfo {
  const { B, H, B1 } = beamDims(info);
  const size = formatBeamSize(B, H);
  return {
    ...info,
    beamB: B,
    beamH: H,
    beamB1: B1,
    beamSizeX: size,
    beamSizeY: size,
    beamCountX: Math.max(2, Math.round(axesXLen ?? info.beamCountX ?? 2)),
    beamCountY: Math.max(2, Math.round(axesYLen ?? info.beamCountY ?? 2)),
  };
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

/**
 * Đặt số lượng trục / dầm: giữ kích thước tổng, chia đều nhịp.
 * Tái dùng id/tên trục cũ khi còn.
 */
export function setAxisCount(
  axes: GridAxis[],
  count: number,
  totalMm: number,
  dir: "X" | "Y",
): GridAxis[] {
  const n = Math.max(2, Math.floor(count) || 2);
  const sorted = sortAxes(axes);
  const total = Math.max(500, totalMm || sorted[sorted.length - 1]?.pos || 6000);
  const span = Math.round(total / (n - 1));
  const out: GridAxis[] = [];
  for (let i = 0; i < n; i++) {
    const prev = sorted[i];
    let name = prev?.name;
    if (!name) {
      name = dir === "X" ? nextAxisNameX(out) : nextAxisNameY(out);
    }
    out.push({
      id: prev?.id ?? uid(dir === "X" ? "ax" : "ay"),
      name,
      pos: i === n - 1 ? total : i * span,
    });
  }
  return out;
}

function parseSize(size: string): { b: number; h: number } {
  const m = size.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
  return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
}

export function beamsFromAxes(project: SlabProject): PlanBeam[] {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const { planWidth: W, planHeight: Hplan } = planSizeFromAxes(axesX, axesY);
  const prefix = project.info.beamNamePrefix || "D";
  const { B, H, B1 } = beamDims(project.info);
  const defaultSize = formatBeamSize(B, H);
  const prev = project.beams ?? [];
  const findPrev = (direction: PlanBeam["direction"], axisId: string, axis: number) =>
    prev.find((b) => b.axisId === axisId) ||
    prev.find((b) => b.direction === direction && Math.abs(b.axis - axis) < 0.5);

  const beams: PlanBeam[] = [];
  let n = 1;
  for (const ax of axesX) {
    const old = findPrev("Y", ax.id, ax.pos);
    const dims = old ? parseSize(old.size) : { b: B, h: H };
    beams.push({
      id: old?.id ?? uid("beam"),
      name: old?.name ?? `${prefix}${n++}`,
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "Y",
      axis: ax.pos,
      axisId: ax.id,
      start: 0,
      end: Hplan,
      offset: Number.isFinite(old?.offset) ? (old!.offset as number) : B1,
    });
  }
  for (const ay of axesY) {
    const old = findPrev("X", ay.id, ay.pos);
    const dims = old ? parseSize(old.size) : { b: B, h: H };
    beams.push({
      id: old?.id ?? uid("beam"),
      name: old?.name ?? `${prefix}${n++}`,
      size: old ? formatBeamSize(dims.b, dims.h) : defaultSize,
      direction: "X",
      axis: ay.pos,
      axisId: ay.id,
      start: 0,
      end: W,
      offset: Number.isFinite(old?.offset) ? (old!.offset as number) : B1,
    });
  }
  return beams;
}

/** Cập nhật kích thước một dầm theo trục (giữ các dầm khác). */
export function patchBeamOnAxis(
  project: SlabProject,
  dir: PlanBeam["direction"],
  axisIndex: number,
  dims: { beamB?: number; beamH?: number; beamB1?: number },
): SlabProject {
  const axes = sortAxes(dir === "Y" ? project.axesX : project.axesY);
  const axis = axes[axisIndex];
  if (!axis) return project;
  const current = (project.beams ?? []).find(
    (b) => b.axisId === axis.id || (b.direction === dir && Math.abs(b.axis - axis.pos) < 0.5),
  );
  const parsed = parseSize(current?.size ?? formatBeamSize(project.info.beamB, project.info.beamH));
  const B = dims.beamB ?? parsed.b;
  const H = dims.beamH ?? parsed.h;
  const B1 = dims.beamB1 ?? current?.offset ?? Math.round(B / 2);
  const size = formatBeamSize(B, H);
  const beams = (project.beams?.length ? project.beams : beamsFromAxes(project)).map((b) => {
    const match = b.axisId === axis.id || (b.direction === dir && Math.abs(b.axis - axis.pos) < 0.5);
    return match ? { ...b, size, offset: B1, axisId: axis.id, axis: axis.pos } : b;
  });
  return { ...project, beams };
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
  const info = syncBeamInfo(project.info, axesX.length, axesY.length);
  return { ...project, info, axesX, axesY, ...size };
}

export function applyAxesToProject(project: SlabProject): SlabProject {
  const withAxes = ensureAxes(project);
  const size = planSizeFromAxes(withAxes.axesX, withAxes.axesY);
  const info = syncBeamInfo(withAxes.info, withAxes.axesX.length, withAxes.axesY.length);
  const next = { ...withAxes, info, ...size };
  return { ...next, beams: beamsFromAxes(next) };
}

/** Đổi số lượng dầm theo X / Y rồi dựng lại trục + dầm. */
export function applyBeamCounts(
  project: SlabProject,
  countX?: number,
  countY?: number,
): SlabProject {
  const base = ensureAxes(project);
  const cx = Math.max(2, Math.round(countX ?? base.info.beamCountX ?? base.axesX.length));
  const cy = Math.max(2, Math.round(countY ?? base.info.beamCountY ?? base.axesY.length));
  const axesX =
    cx === base.axesX.length
      ? base.axesX
      : setAxisCount(base.axesX, cx, base.planWidth || 6000, "X");
  const axesY =
    cy === base.axesY.length
      ? base.axesY
      : setAxisCount(base.axesY, cy, base.planHeight || 4500, "Y");
  return applyAxesToProject({
    ...base,
    axesX,
    axesY,
    info: { ...base.info, beamCountX: cx, beamCountY: cy },
  });
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
