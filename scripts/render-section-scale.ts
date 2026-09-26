/**
 * PDF mặt cắt với B=200, Hs=120, H=500 — kiểm tra tỉ lệ.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { generateSlabPdf } from "../lib/pdf/generate";
import { createSampleS1 } from "../lib/sample";
import { ensureSectionCuts, sortAxes } from "../lib/grid";
import { uid } from "../lib/utils";

async function main() {
  const root = resolve(__dirname, "..");
  const regular = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Regular.ttf"));
  const bold = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Bold.ttf"));

  let project = createSampleS1();
  const xs = sortAxes(project.axesX ?? []);
  const ys = sortAxes(project.axesY ?? []);
  project = {
    ...project,
    info: {
      ...project.info,
      thickness: 120,
      beamB: 200,
      beamH: 500,
      beamB1: 100,
      beamSizeX: "200x500",
      beamSizeY: "200x500",
      lowSlabDrop: 0,
    },
    beams: project.beams.map((b) => ({
      ...b,
      size: "200x500",
      offset:
        b.axis === 0
          ? 0
          : b.axis === (b.direction === "Y" ? project.planWidth : project.planHeight)
            ? 200
            : 100,
    })),
    lowSlabs: [],
    openings: [],
    sections: ensureSectionCuts({
      ...project,
      sections: [
        {
          id: uid("sec"),
          name: "1",
          textHeight: 150,
          direction: "X",
          at: 3000,
          from: 0,
          to: project.planHeight,
          axisId: xs[1]?.id ?? xs[0]?.id,
          offsetMm: 0,
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

  const fonts = {
    regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
    bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
  };
  const bytes = await generateSlabPdf(project, fonts);
  const outDir = "/opt/cursor/artifacts";
  mkdirSync(`${outDir}/screenshots`, { recursive: true });
  writeFileSync(resolve(outDir, "KetCauSan_section-scale.pdf"), bytes);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const b64 = Buffer.from(bytes).toString("base64");
  const scale = 1.6;
  await page.setContent(
    `<!doctype html><html><body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const data=atob("${b64}"); const arr=new Uint8Array(data.length);
for(let i=0;i<data.length;i++) arr[i]=data.charCodeAt(i);
window.__ready=pdfjsLib.getDocument({data:arr}).promise.then(async pdf=>{
  const pg=await pdf.getPage(1);
  const tc=await pg.getTextContent();
  window.__texts=tc.items.map(i=>i.str).filter(Boolean);
  const vp=pg.getViewport({scale:${scale}});
  const c=document.createElement("canvas");
  c.width=vp.width; c.height=vp.height;
  await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
  const ox=Math.floor(860*${scale}), oy=Math.floor(48*${scale});
  const w=Math.floor(800*${scale}), h=Math.floor(280*${scale});
  const out=document.createElement("canvas"); out.width=w; out.height=h;
  out.getContext("2d").drawImage(c, ox, oy, w, h, 0, 0, w, h);
  window.__sec=out.toDataURL("image/png");
  return 1;
});
</script></body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.waitForFunction(() => (window as unknown as { __ready: Promise<number> }).__ready);
  const texts = (await page.evaluate(
    () => (window as unknown as { __texts: string[] }).__texts,
  )) as string[];
  console.log(
    "dims/labels:\n" +
      texts.filter((t) => /MẶT CẮT|120|200|500|B×H|TL|D[0-9]|trục/i.test(t)).join("\n"),
  );
  const dataUrl = (await page.evaluate(
    () => (window as unknown as { __sec: string }).__sec,
  )) as string;
  writeFileSync(
    `${outDir}/screenshots/pdf-section-scale-BH.png`,
    Buffer.from(dataUrl.split(",")[1]!, "base64"),
  );
  writeFileSync(
    `${outDir}/pdf-section-scale-B200-H500-Hs120.png`,
    Buffer.from(dataUrl.split(",")[1]!, "base64"),
  );
  console.log("wrote screenshots");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
