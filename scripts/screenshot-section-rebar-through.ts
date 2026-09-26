import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const root = resolve(__dirname, "..");
  const bytes = readFileSync(resolve(root, "docs/section-rebar-through.pdf"));
  const outDir = resolve(root, "docs");
  mkdirSync(outDir, { recursive: true });
  const b64 = Buffer.from(bytes).toString("base64");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } });
  await page.setContent(`<!doctype html>
<html><body style="margin:0;background:#222">
<canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const data = atob("${b64}");
const arr = new Uint8Array(data.length);
for (let i = 0; i < data.length; i++) arr[i] = data.charCodeAt(i);
window.__ready = pdfjsLib.getDocument({ data: arr }).promise.then(async (pdf) => {
  const pg = await pdf.getPage(1);
  const vp = pg.getViewport({ scale: 1.35 });
  const c = document.getElementById("c");
  c.width = vp.width; c.height = vp.height;
  await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return { w: vp.width, h: vp.height };
});
</script></body></html>`);
  const dims = await page.waitForFunction(() => (window as any).__ready).then((h) => h.jsonValue()) as { w: number; h: number };
  await page.setViewportSize({ width: Math.ceil(dims.w), height: Math.ceil(dims.h) });
  const full = resolve(outDir, "section-rebar-through-page.png");
  await page.locator("#c").screenshot({ path: full });
  // Crop lower portion where sections usually sit (under plans)
  const buf = readFileSync(full);
  // Use sharp if available, else playwright clip
  const h = dims.h;
  const w = dims.w;
  // Sections are typically in bottom ~40% of page 1 for this layout
  const clipPage = await browser.newPage({ viewport: { width: Math.ceil(w), height: Math.ceil(h * 0.42) } });
  await clipPage.setContent(`<!doctype html><html><body style="margin:0">
<img id="img" src="file://${full}" style="position:absolute;top:-${Math.floor(h * 0.55)}px;left:0;width:${w}px"/>
</body></html>`);
  await clipPage.waitForTimeout(200);
  const crop = resolve(outDir, "section-rebar-through.png");
  await clipPage.screenshot({ path: crop });
  await browser.close();
  console.log("wrote", crop, full);
}
main().catch((e) => { console.error(e); process.exit(1); });
