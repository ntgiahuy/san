/**
 * Generate PDF with openings + low slabs to verify A-A / B-B section cuts.
 * Usage: npx tsx scripts/render-section-cuts.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { generateSlabPdf } from "../lib/pdf/generate";
import { createSampleS1 } from "../lib/sample";
import { sortAxes, baySlabExtent, ensureSectionCuts } from "../lib/grid";
import { uid } from "../lib/utils";

async function main() {
  const root = resolve(__dirname, "..");
  const regular = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Regular.ttf"));
  const bold = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Bold.ttf"));

  let project = createSampleS1();
  const xs = sortAxes(project.axesX ?? []);
  const ys = sortAxes(project.axesY ?? []);
  // Ô (0,0): sàn thấp nhấn; cần ≥2×2 ô — mẫu 3×2 trục → 2×1 ô, thêm trục Y giữa
  // Mẫu mặc định: X=1,2,3 Y=A,B → 2 cột × 1 hàng ô. Đặt sàn thấp ô trái, thủng ô phải.
  const left = baySlabExtent(project, xs, ys, 0, 0);
  const right = baySlabExtent(project, xs, ys, 1, 0);
  project = {
    ...project,
    lowSlabs: [
      {
        id: uid("ls"),
        name: "ST1",
        x: left.x0,
        y: left.y0,
        w: left.x1 - left.x0,
        h: left.y1 - left.y0,
        drop: project.info.lowSlabDrop || 200,
        rebarMode: "press",
      },
    ],
    openings: [
      {
        id: uid("op"),
        name: "Ô1",
        x: right.x0,
        y: right.y0,
        w: right.x1 - right.x0,
        h: right.y1 - right.y0,
      },
    ],
    sections: ensureSectionCuts({
      ...project,
      sections: [
        {
          id: uid("sec"),
          name: "1",
          textHeight: 150,
          direction: "X",
          at: 1500,
          from: 0,
          to: project.planHeight,
          axisId: xs[0]?.id,
          offsetMm: 1500,
        },
        {
          id: uid("sec"),
          name: "1",
          textHeight: 150,
          direction: "Y",
          at: 2250,
          from: 0,
          to: project.planWidth,
          axisId: ys[0]?.id,
          offsetMm: 2250,
        },
      ],
    }),
  };

  const bytes = await generateSlabPdf(project, {
    regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
    bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
  });
  const outDir = "/opt/cursor/artifacts";
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "KetCauSan_section-cuts.pdf");
  writeFileSync(out, bytes);
  console.log("Wrote", out, bytes.byteLength, "bytes");
  console.log(
    "sections",
    project.sections.map((s) => `${s.direction}@${s.at}`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
