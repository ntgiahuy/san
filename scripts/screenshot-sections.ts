import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const bytes = readFileSync("/opt/cursor/artifacts/KetCauSan_section-cuts.pdf");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const b64 = Buffer.from(bytes).toString("base64");
  const scale = 1.5;
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
  const texts=tc.items.map(i=>i.str).filter(Boolean);
  window.__texts=texts;
  const vp=pg.getViewport({scale:${scale}});
  const c=document.createElement("canvas");
  c.width=vp.width; c.height=vp.height;
  await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
  const ox=Math.floor(860*${scale}), oy=Math.floor(48*${scale});
  const w=Math.floor(800*${scale}), h=Math.floor(420*${scale});
  const out=document.createElement("canvas"); out.width=w; out.height=h;
  out.getContext("2d").drawImage(c, ox, oy, w, h, 0, 0, w, h);
  window.__sec=out.toDataURL("image/png");
  const aa=document.createElement("canvas"); aa.width=w; aa.height=Math.floor(200*${scale});
  aa.getContext("2d").drawImage(c, ox, oy, w, Math.floor(200*${scale}), 0, 0, w, Math.floor(200*${scale}));
  window.__aa=aa.toDataURL("image/png");
  const bb=document.createElement("canvas"); bb.width=w; bb.height=Math.floor(220*${scale});
  bb.getContext("2d").drawImage(c, ox, oy+Math.floor(190*${scale}), w, Math.floor(220*${scale}), 0, 0, w, Math.floor(220*${scale}));
  window.__bb=bb.toDataURL("image/png");
  return texts;
});
</script></body></html>`,
    { waitUntil: "networkidle" },
  );
  const texts = (await page
    .waitForFunction(() => (window as unknown as { __ready: Promise<string[]> }).__ready)
    .then((h) => h.jsonValue())) as string[];
  const interesting = texts.filter((t) =>
    /MẶT CẮT|A-A|B-B|ST1|Ô1|thủng|trục|TL|D[0-9]|−|nhấn|cắt/i.test(t),
  );
  console.log("interesting texts:\n" + interesting.join("\n"));
  mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
  for (const [key, name] of [
    ["__sec", "pdf-sections-crop.png"],
    ["__aa", "pdf-section-AA.png"],
    ["__bb", "pdf-section-BB.png"],
  ] as const) {
    const dataUrl = (await page.evaluate((k) => (window as unknown as Record<string, string>)[k], key)) as string;
    const b = Buffer.from(dataUrl.split(",")[1]!, "base64");
    writeFileSync(`/opt/cursor/artifacts/screenshots/${name}`, b);
    console.log("wrote", name, b.length);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
