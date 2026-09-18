/**
 * Phối cảnh dầm sàn (axonometric / hidden-line) — dùng chung UI 3D + PDF.
 * Phong cách bản vẽ shop: mặt trắng, nét đen, cột + dầm hộp, cao độ, ô thủng X.
 */
import {
  baySlabExtent,
  beamSegSideFaces,
  beamSegments,
  isBeamSegOmitted,
  sortAxes,
} from "./grid";
import type { PlanBeam, SlabProject } from "./types";

export type Pt3 = { x: number; y: number; z: number };
export type Pt2 = { x: number; y: number };

export type Face3 = {
  pts: Pt3[];
  /** fill: slab/beam/column mặt đặc; hatch: sàn thấp chấm; opening: chỉ X */
  kind: "solid" | "hatch" | "opening";
};

export type Edge3 = { a: Pt3; b: Pt3; hidden?: boolean };

export type LevelMark3 = {
  at: Pt3;
  elevText: string;
  hsText: string;
};

export type Scene3D = {
  faces: Face3[];
  openingXs: Array<[Pt3, Pt3]>;
  marks: LevelMark3[];
  title: string;
  subtitle: string;
  /** Bao hình học mm (trước chiếu). */
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
};

function parseBH(size?: string): { b: number; h: number } {
  const m = (size ?? "").trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)/);
  return m ? { b: Number(m[1]), h: Number(m[2]) } : { b: 220, h: 500 };
}

/** Chiếu isometric (nhìn từ góc +X/+Y, Z lên). */
export function projectIso(p: Pt3): Pt2 & { depth: number } {
  const cos = Math.sqrt(3) / 2; // 30°
  const sin = 0.5;
  return {
    x: (p.x - p.y) * cos,
    y: -p.z + (p.x + p.y) * sin,
    depth: p.x + p.y + p.z * 0.35,
  };
}

function faceDepth(face: Face3): number {
  let s = 0;
  for (const p of face.pts) s += p.x + p.y + p.z * 0.35;
  return s / Math.max(face.pts.length, 1);
}

/** Pháp tuyến mặt (ước lượng) · hướng nhìn — loại mặt sau. */
function faceFrontFacing(face: Face3): boolean {
  if (face.pts.length < 3) return true;
  const a = face.pts[0];
  const b = face.pts[1];
  const c = face.pts[2];
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  // Hướng nhìn isometric ~ (-1,-1,-1) trong không gian đã chiếu… dùng (1,1,1) từ góc nhìn
  const viewX = 1;
  const viewY = 1;
  const viewZ = 1;
  return nx * viewX + ny * viewY + nz * viewZ < 0;
}

function boxFaces(
  cornersBot: [Pt3, Pt3, Pt3, Pt3],
  cornersTop: [Pt3, Pt3, Pt3, Pt3],
  kind: Face3["kind"] = "solid",
): Face3[] {
  const [b0, b1, b2, b3] = cornersBot;
  const [t0, t1, t2, t3] = cornersTop;
  const faces: Face3[] = [
    { pts: [t0, t1, t2, t3], kind }, // top
    { pts: [b0, b3, b2, b1], kind }, // bottom
    { pts: [b0, b1, t1, t0], kind },
    { pts: [b1, b2, t2, t1], kind },
    { pts: [b2, b3, t3, t2], kind },
    { pts: [b3, b0, t0, t3], kind },
  ];
  return faces.filter((f) => f.kind !== "solid" || faceFrontFacing(f));
}

function rectPrism(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): Face3[] {
  const b0 = { x: x0, y: y0, z: z0 };
  const b1 = { x: x1, y: y0, z: z0 };
  const b2 = { x: x1, y: y1, z: z0 };
  const b3 = { x: x0, y: y1, z: z0 };
  const t0 = { x: x0, y: y0, z: z1 };
  const t1 = { x: x1, y: y0, z: z1 };
  const t2 = { x: x1, y: y1, z: z1 };
  const t3 = { x: x0, y: y1, z: z1 };
  return boxFaces([b0, b1, b2, b3], [t0, t1, t2, t3], "solid");
}

/** Lấy cao độ sàn (m) — mặc định 8.05 như bản mẫu. */
export function floorElevationM(project: SlabProject): number {
  const v = Number(project.info.floorElevationM);
  return Number.isFinite(v) ? v : 8.05;
}

/**
 * Dựng scene phối cảnh dầm + cột ngắn tại giao trục.
 * Z: đỉnh dầm = 0; thân dầm xuống −H; cột tiếp tục xuống.
 */
export function buildBeamFrameScene(project: SlabProject): Scene3D {
  const axesX = sortAxes(project.axesX ?? []);
  const axesY = sortAxes(project.axesY ?? []);
  const faces: Face3[] = [];
  const openingXs: Array<[Pt3, Pt3]> = [];
  const marks: LevelMark3[] = [];

  let maxH = 500;
  for (const b of project.beams ?? []) {
    maxH = Math.max(maxH, parseBH(b.size).h);
  }
  const colDrop = Math.round(maxH * 1.35); // cột nhô dưới dầm
  const zBeamTop = 0;
  const zBeamBot = -maxH;
  const zColBot = zBeamBot - colDrop;

  // —— Cột tại giao trục (ô vuông ~ max B gặp nhau) ——
  for (const ax of axesX) {
    for (const ay of axesY) {
      const beamsAt: PlanBeam[] = (project.beams ?? []).filter(
        (b) =>
          !b.free &&
          ((b.direction === "Y" && Math.abs(b.axis - ax.pos) < 0.5) ||
            (b.direction === "X" && Math.abs(b.axis - ay.pos) < 0.5)),
      );
      if (beamsAt.length === 0) continue;
      let half = 150;
      for (const b of beamsAt) half = Math.max(half, parseBH(b.size).b / 2);
      half = Math.round(half);
      faces.push(
        ...rectPrism(ax.pos - half, ay.pos - half, ax.pos + half, ay.pos + half, zColBot, zBeamTop),
      );
    }
  }

  // —— Dầm theo đoạn (có lệch/xéo) ——
  for (const beam of project.beams ?? []) {
    const { h } = parseBH(beam.size);
    const z0 = zBeamTop - h;
    const z1 = zBeamTop;
    const segs = beamSegments(project, beam);
    for (const seg of segs) {
      if (isBeamSegOmitted(beam, seg.a0.id, seg.a1.id)) continue;
      const { lo0, hi0, lo1, hi1 } = beamSegSideFaces(beam, seg.index);
      const lo = seg.lo;
      const hi = seg.hi;
      if (beam.direction === "Y") {
        // Chạy theo Y; mặt cắt theo X thay đổi đầu→cuối
        const b0 = { x: lo0, y: lo, z: z0 };
        const b1 = { x: hi0, y: lo, z: z0 };
        const b2 = { x: hi1, y: hi, z: z0 };
        const b3 = { x: lo1, y: hi, z: z0 };
        const t0 = { x: lo0, y: lo, z: z1 };
        const t1 = { x: hi0, y: lo, z: z1 };
        const t2 = { x: hi1, y: hi, z: z1 };
        const t3 = { x: lo1, y: hi, z: z1 };
        faces.push(...boxFaces([b0, b1, b2, b3], [t0, t1, t2, t3], "solid"));
      } else {
        const b0 = { x: lo, y: lo0, z: z0 };
        const b1 = { x: hi, y: lo0, z: z0 };
        const b2 = { x: hi, y: hi1, z: z0 };
        const b3 = { x: lo, y: hi1, z: z0 };
        const t0 = { x: lo, y: lo0, z: z1 };
        const t1 = { x: hi, y: lo0, z: z1 };
        const t2 = { x: hi, y: hi1, z: z1 };
        const t3 = { x: lo, y: hi1, z: z1 };
        faces.push(...boxFaces([b0, b1, b2, b3], [t0, t1, t2, t3], "solid"));
      }
    }
  }

  // —— Sàn thấp: mặt chấm trên đỉnh ——
  for (const ls of project.lowSlabs ?? []) {
    const x0 = ls.x;
    const y0 = ls.y;
    const x1 = ls.x + ls.w;
    const y1 = ls.y + ls.h;
    const drop = Math.max(0, ls.drop || project.info.lowSlabDrop || 0);
    const z = zBeamTop - drop * 0.15; // hơi thấp hơn mặt chính (nhẹ)
    faces.push({
      pts: [
        { x: x0, y: y0, z },
        { x: x1, y: y0, z },
        { x: x1, y: y1, z },
        { x: x0, y: y1, z },
      ],
      kind: "hatch",
    });
  }

  // —— Ô thủng: X trên mặt đỉnh ——
  for (const o of project.openings ?? []) {
    const x0 = o.x;
    const y0 = o.y;
    const x1 = o.x + o.w;
    const y1 = o.y + o.h;
    const z = zBeamTop + 2;
    openingXs.push(
      [
        { x: x0, y: y0, z },
        { x: x1, y: y1, z },
      ],
      [
        { x: x0, y: y1, z },
        { x: x1, y: y0, z },
      ],
    );
  }

  // —— Cao độ ——
  const elev = floorElevationM(project);
  const hs = Math.round(project.info.thickness || 100);
  if (axesX.length >= 2 && axesY.length >= 2) {
    const bay0 = baySlabExtent(project, axesX, axesY, 0, 0);
    marks.push({
      at: { x: bay0.mx, y: bay0.my, z: zBeamTop + 20 },
      elevText: `+${elev.toFixed(3)}`,
      hsText: `Hs=${hs}`,
    });
    if (axesX.length > 2 || axesY.length > 2) {
      const ix = Math.min(axesX.length - 2, 1);
      const iy = Math.min(axesY.length - 2, axesY.length > 2 ? 1 : 0);
      const bay1 = baySlabExtent(project, axesX, axesY, ix, iy);
      const elev2 = elev - 0.05;
      marks.push({
        at: { x: bay1.mx, y: bay1.my, z: zBeamTop + 20 },
        elevText: `+${elev2.toFixed(3)}`,
        hsText: `Hs=${hs}`,
      });
    }
  }

  // Bounds
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  const consider = (p: Pt3) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  };
  for (const f of faces) for (const p of f.pts) consider(p);
  for (const [a, b] of openingXs) {
    consider(a);
    consider(b);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    minZ = 0;
    maxX = project.planWidth;
    maxY = project.planHeight;
    maxZ = 0;
  }

  const floorName = (project.info.name || "SÀN").trim() || "SÀN";
  return {
    faces: faces.sort((a, b) => faceDepth(b) - faceDepth(a)),
    openingXs,
    marks,
    title: `PHỐI CẢNH DẦM ${floorName.toUpperCase()}`,
    subtitle: `TL: 1/${project.info.drawingScale || 100}`,
    bounds: { minX, minY, minZ, maxX, maxY, maxZ },
  };
}

export type ProjectedScene = {
  polygons: Array<{ points: string; kind: Face3["kind"]; depth: number }>;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  marks: Array<{ x: number; y: number; elevText: string; hsText: string }>;
  title: string;
  subtitle: string;
  /** viewBox width/height in projected units */
  width: number;
  height: number;
  pad: number;
};

/** Chiếu scene → tọa độ 2D (gốc trên-trái, Y xuống như SVG). */
export function projectSceneToSvg(
  scene: Scene3D,
  opts?: { width?: number; height?: number; pad?: number },
): ProjectedScene {
  const pad = opts?.pad ?? 48;
  const targetW = opts?.width ?? 920;
  const targetH = opts?.height ?? 560;

  const projectedFaces = scene.faces.map((f) => {
    const pts = f.pts.map(projectIso);
    const depth = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
    return { kind: f.kind, pts, depth };
  });
  projectedFaces.sort((a, b) => a.depth - b.depth); // xa → gần (vẽ sau = đè)

  const allPts = projectedFaces.flatMap((f) => f.pts);
  for (const [a, b] of scene.openingXs) {
    allPts.push(projectIso(a), projectIso(b));
  }
  for (const m of scene.marks) allPts.push(projectIso(m.at));

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of allPts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((targetW - pad * 2) / spanX, (targetH - pad * 2 - 36) / spanY);

  const mapX = (x: number) => pad + (x - minX) * scale;
  // SVG Y xuống: đảo trục chiếu
  const mapY = (y: number) => pad + (maxY - y) * scale;

  const polygons = projectedFaces.map((f) => ({
    kind: f.kind,
    depth: f.depth,
    points: f.pts.map((p) => `${mapX(p.x).toFixed(2)},${mapY(p.y).toFixed(2)}`).join(" "),
  }));

  const lines = scene.openingXs.map(([a, b]) => {
    const pa = projectIso(a);
    const pb = projectIso(b);
    return { x1: mapX(pa.x), y1: mapY(pa.y), x2: mapX(pb.x), y2: mapY(pb.y) };
  });

  const marks = scene.marks.map((m) => {
    const p = projectIso(m.at);
    return { x: mapX(p.x), y: mapY(p.y), elevText: m.elevText, hsText: m.hsText };
  });

  const width = pad * 2 + spanX * scale;
  const height = pad * 2 + spanY * scale + 40;

  return {
    polygons,
    lines,
    marks,
    title: scene.title,
    subtitle: scene.subtitle,
    width,
    height,
    pad,
  };
}
