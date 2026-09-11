"use client";

import { useMemo, type ReactNode } from "react";
import { effectiveZones, parseBeamSize } from "@/lib/calc";
import { sortAxes } from "@/lib/grid";
import type { PlanSelection, SlabProject } from "@/lib/types";

export function SlabPreview({
  project,
  show3d,
  selection = null,
  onSelect,
  interactive = false,
}: {
  project: SlabProject;
  show3d?: boolean;
  selection?: PlanSelection | null;
  onSelect?: (sel: PlanSelection | null) => void;
  /** Cho phép nhấp chọn ô sàn / đoạn dầm trên bản vẽ. */
  interactive?: boolean;
}) {
  const zones = useMemo(() => effectiveZones(project), [project]);
  const axesX = useMemo(() => sortAxes(project.axesX ?? []), [project.axesX]);
  const axesY = useMemo(() => sortAxes(project.axesY ?? []), [project.axesY]);

  const W = 640;
  const H = 420;
  const pad = 48;
  const sx = (W - pad * 2) / Math.max(project.planWidth, 1);
  const sy = (H - pad * 2) / Math.max(project.planHeight, 1);
  const s = Math.min(sx, sy);
  const ox = pad + (W - pad * 2 - project.planWidth * s) / 2;
  const oy = pad + (H - pad * 2 - project.planHeight * s) / 2;
  const X = (mm: number) => ox + mm * s;
  const Y = (mm: number) => oy + (project.planHeight - mm) * s;

  if (show3d) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-zinc-950 p-4">
        <svg viewBox="0 0 640 360" className="h-full w-full max-h-[340px]">
          <defs>
            <linearGradient id="slabFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f3f46" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
          </defs>
          <polygon
            points="120,220 420,160 560,210 260,280"
            fill="url(#slabFace)"
            stroke="#79b8ff"
            strokeWidth="1.5"
          />
          <polygon points="120,220 260,280 260,300 120,240" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <polygon points="260,280 560,210 560,230 260,300" fill="#09090b" stroke="#52525b" strokeWidth="1" />
          {zones.slice(0, 4).map((z, i) => {
            const y = 175 + i * 8;
            return (
              <line
                key={z.id}
                x1={160 + i * 12}
                y1={y}
                x2={480 - i * 8}
                y2={y - 28}
                stroke={z.layer === "top" ? "#fbbf24" : "#34d399"}
                strokeWidth="1.2"
              />
            );
          })}
          <text x="320" y="330" textAnchor="middle" fill="#a1a1aa" fontSize="12">
            Mô hình 3D sàn {project.info.name} — {project.info.thickness} mm
          </text>
        </svg>
      </div>
    );
  }

  const bayNodes: ReactNode[] = [];
  for (let ix = 0; ix < axesX.length - 1; ix++) {
    for (let iy = 0; iy < axesY.length - 1; iy++) {
      const x0 = axesX[ix].pos;
      const x1 = axesX[ix + 1].pos;
      const y0 = axesY[iy].pos;
      const y1 = axesY[iy + 1].pos;
      const active = selection?.kind === "bay" && selection.ix === ix && selection.iy === iy;
      bayNodes.push(
        <g key={`bay-${ix}-${iy}`}>
          <rect
            x={X(x0)}
            y={Y(y1)}
            width={(x1 - x0) * s}
            height={(y1 - y0) * s}
            fill={active ? "rgba(56,189,248,0.18)" : interactive ? "rgba(39,39,42,0.35)" : "transparent"}
            stroke={active ? "#38bdf8" : "transparent"}
            strokeWidth={active ? 1.6 : 0}
            className={interactive ? "cursor-pointer" : undefined}
            pointerEvents={interactive ? "all" : "none"}
            onClick={(e) => {
              if (!interactive || !onSelect) return;
              e.stopPropagation();
              onSelect({ kind: "bay", ix, iy });
            }}
          />
          {active && (
            <text
              x={X((x0 + x1) / 2)}
              y={Y((y0 + y1) / 2)}
              textAnchor="middle"
              fill="#7dd3fc"
              fontSize="11"
              fontWeight="700"
              pointerEvents="none"
            >
              {axesX[ix].name}-{axesY[iy].name} · {Math.round(x1 - x0)}×{Math.round(y1 - y0)}
            </text>
          )}
        </g>,
      );
    }
  }

  const beamSegNodes: ReactNode[] = [];
  // Dầm đứng trên trục X — đoạn giữa các trục Y
  axesX.forEach((ax, axisIndex) => {
    const beam = project.beams.find(
      (b) => b.axisId === ax.id || (b.direction === "Y" && Math.abs(b.axis - ax.pos) < 0.5),
    );
    const { b: bw } = parseBeamSize(beam?.size ?? project.info.beamSizeX);
    const b1 = Number.isFinite(beam?.offset) ? (beam!.offset as number) : bw / 2;
    for (let segIndex = 0; segIndex < axesY.length - 1; segIndex++) {
      const y0 = axesY[segIndex].pos;
      const y1 = axesY[segIndex + 1].pos;
      const active =
        selection?.kind === "beamSeg" &&
        selection.dir === "Y" &&
        selection.axisIndex === axisIndex &&
        selection.segIndex === segIndex;
      beamSegNodes.push(
        <g key={`by-${axisIndex}-${segIndex}`}>
          <rect
            x={X(ax.pos) - b1 * s}
            y={Y(Math.max(y0, y1))}
            width={bw * s}
            height={Math.abs(y1 - y0) * s}
            fill={active ? "rgba(52,211,153,0.45)" : "#27272a"}
            stroke={active ? "#34d399" : "#a1a1aa"}
            strokeWidth={active ? 2 : 1}
            className={interactive ? "cursor-pointer" : undefined}
            pointerEvents={interactive ? "all" : "none"}
            onClick={(e) => {
              if (!interactive || !onSelect) return;
              e.stopPropagation();
              onSelect({ kind: "beamSeg", dir: "Y", axisIndex, segIndex });
            }}
          />
          {active && (
            <text
              x={X(ax.pos) + (bw - b1) * s + 4}
              y={Y((y0 + y1) / 2)}
              fill="#6ee7b7"
              fontSize="10"
              fontWeight="700"
              pointerEvents="none"
            >
              {beam?.name ?? `D${axisIndex + 1}`} · L={Math.round(y1 - y0)}
            </text>
          )}
        </g>,
      );
    }
  });
  // Dầm ngang trên trục Y — đoạn giữa các trục X
  axesY.forEach((ay, axisIndex) => {
    const beam = project.beams.find(
      (b) => b.axisId === ay.id || (b.direction === "X" && Math.abs(b.axis - ay.pos) < 0.5),
    );
    const { b: bw } = parseBeamSize(beam?.size ?? project.info.beamSizeY);
    const b1 = Number.isFinite(beam?.offset) ? (beam!.offset as number) : bw / 2;
    for (let segIndex = 0; segIndex < axesX.length - 1; segIndex++) {
      const x0 = axesX[segIndex].pos;
      const x1 = axesX[segIndex + 1].pos;
      const active =
        selection?.kind === "beamSeg" &&
        selection.dir === "X" &&
        selection.axisIndex === axisIndex &&
        selection.segIndex === segIndex;
      beamSegNodes.push(
        <g key={`bx-${axisIndex}-${segIndex}`}>
          <rect
            x={X(Math.min(x0, x1))}
            y={Y(ay.pos) - b1 * s}
            width={Math.abs(x1 - x0) * s}
            height={bw * s}
            fill={active ? "rgba(52,211,153,0.45)" : "#27272a"}
            stroke={active ? "#34d399" : "#a1a1aa"}
            strokeWidth={active ? 2 : 1}
            className={interactive ? "cursor-pointer" : undefined}
            pointerEvents={interactive ? "all" : "none"}
            onClick={(e) => {
              if (!interactive || !onSelect) return;
              e.stopPropagation();
              onSelect({ kind: "beamSeg", dir: "X", axisIndex, segIndex });
            }}
          />
          {active && (
            <text
              x={X((x0 + x1) / 2)}
              y={Y(ay.pos) - b1 * s - 6}
              textAnchor="middle"
              fill="#6ee7b7"
              fontSize="10"
              fontWeight="700"
              pointerEvents="none"
            >
              {beam?.name ?? `D`} · L={Math.round(x1 - x0)}
            </text>
          )}
        </g>,
      );
    }
  });

  return (
    <div className="flex h-full min-h-[280px] flex-col bg-zinc-950">
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full max-h-[400px]"
          onClick={() => {
            if (interactive && onSelect) onSelect(null);
          }}
        >
          <rect
            x={X(0)}
            y={Y(project.planHeight)}
            width={project.planWidth * s}
            height={project.planHeight * s}
            fill="#111113"
            stroke="#79b8ff"
            strokeWidth="1.5"
            pointerEvents="none"
          />
          {bayNodes}
          {axesX.map((ax) => (
            <g key={`ax-${ax.id}`} pointerEvents="none">
              <line
                x1={X(ax.pos)}
                y1={Y(0)}
                x2={X(ax.pos)}
                y2={Y(project.planHeight)}
                stroke="#52525b"
                strokeWidth="0.6"
                strokeDasharray="3 3"
              />
              <circle cx={X(ax.pos)} cy={Y(0) + 16} r="9" fill="#0d1117" stroke="#79b8ff" strokeWidth="1.2" />
              <text
                x={X(ax.pos)}
                y={Y(0) + 20}
                textAnchor="middle"
                fill="#79b8ff"
                fontSize="11"
                fontWeight="700"
              >
                {ax.name}
              </text>
            </g>
          ))}
          {axesY.map((ay) => (
            <g key={`ay-${ay.id}`} pointerEvents="none">
              <line
                x1={X(0)}
                y1={Y(ay.pos)}
                x2={X(project.planWidth)}
                y2={Y(ay.pos)}
                stroke="#52525b"
                strokeWidth="0.6"
                strokeDasharray="3 3"
              />
              <circle cx={X(0) - 16} cy={Y(ay.pos)} r="9" fill="#0d1117" stroke="#fbbf24" strokeWidth="1.2" />
              <text
                x={X(0) - 16}
                y={Y(ay.pos) + 4}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="11"
                fontWeight="700"
              >
                {ay.name}
              </text>
            </g>
          ))}
          {beamSegNodes}
          {zones.map((z) => {
            const x1 = Math.min(z.x1, z.x2);
            const x2 = Math.max(z.x1, z.x2);
            const y1 = Math.min(z.y1, z.y2);
            const y2 = Math.max(z.y1, z.y2);
            const color =
              z.layer === "top" ? "#fbbf24" : z.layer === "structural" ? "#a78bfa" : "#34d399";
            const lines: ReactNode[] = [];
            const step = Math.max(z.spacing, 80);
            if (z.direction === "X") {
              for (let y = y1 + z.cover; y <= y2 - z.cover; y += step) {
                lines.push(
                  <line
                    key={`${z.id}-y${y}`}
                    x1={X(x1 + z.cover)}
                    y1={Y(y)}
                    x2={X(x2 - z.cover)}
                    y2={Y(y)}
                    stroke={color}
                    strokeWidth="0.9"
                    opacity="0.85"
                  />,
                );
              }
            } else {
              for (let x = x1 + z.cover; x <= x2 - z.cover; x += step) {
                lines.push(
                  <line
                    key={`${z.id}-x${x}`}
                    x1={X(x)}
                    y1={Y(y1 + z.cover)}
                    x2={X(x)}
                    y2={Y(y2 - z.cover)}
                    stroke={color}
                    strokeWidth="0.9"
                    opacity="0.85"
                  />,
                );
              }
            }
            return (
              <g key={z.id} pointerEvents="none">
                <rect
                  x={X(x1)}
                  y={Y(y2)}
                  width={(x2 - x1) * s}
                  height={(y2 - y1) * s}
                  fill="none"
                  stroke={color}
                  strokeDasharray="4 3"
                  strokeWidth="1"
                />
                {lines}
                <text
                  x={X((x1 + x2) / 2)}
                  y={Y((y1 + y2) / 2)}
                  textAnchor="middle"
                  fill={color}
                  fontSize="11"
                  fontWeight="700"
                >
                  {z.mark}
                </text>
              </g>
            );
          })}
          <text x={W / 2} y={18} textAnchor="middle" fill="#79b8ff" fontSize="13" fontWeight="700">
            {project.info.name} · {Math.round(project.planWidth)}×{Math.round(project.planHeight)} ×{" "}
            {project.info.thickness}mm
          </text>
        </svg>
      </div>
      <div className="shrink-0 border-t border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-500">
        {interactive
          ? selection
            ? selection.kind === "bay"
              ? `Ô sàn đang chọn: trục ${axesX[selection.ix]?.name ?? "?"}–${axesX[selection.ix + 1]?.name ?? "?"} / ${axesY[selection.iy]?.name ?? "?"}–${axesY[selection.iy + 1]?.name ?? "?"}`
              : `Đoạn dầm đang chọn: phương ${selection.dir} · trục ${
                  selection.dir === "Y"
                    ? axesX[selection.axisIndex]?.name
                    : axesY[selection.axisIndex]?.name
                }`
            : "Nhấp vào ô sàn hoặc đoạn dầm trên bản vẽ để chọn và sửa khoảng cách / kích thước."
          : `${project.info.name} · ${project.beams.length} dầm · ${axesX.length - 1}×${axesY.length - 1} ô`}
      </div>
    </div>
  );
}
