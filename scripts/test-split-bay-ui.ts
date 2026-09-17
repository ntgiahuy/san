/**
 * Playwright: từ 1 ô → chèn X → 2 ô; chèn Y → 4 ô độc lập (selection khác kích thước).
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/opt/cursor/artifacts";
const url = "http://127.0.0.1:4321/san/";

async function selectFirstType(page: import("playwright").Page) {
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("div[role='button']")].filter((el) =>
      el.querySelector('input[title="H dầm (mm)"]'),
    );
    rows[0]?.scrollIntoView({ block: "center" });
    rows[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
}

async function bayRects(page: import("playwright").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("svg rect")]
      .map((el) => {
        const b = el.getBoundingClientRect();
        const fill = el.getAttribute("fill") || "";
        return { w: b.width, h: b.height, x: b.x, y: b.y, fill, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
      })
      .filter((r) => r.w > 30 && r.h > 30 && (r.fill.includes("39,39,42") || r.fill.includes("56,189,248"))),
  );
}

async function clickBayAt(page: import("playwright").Page, index = 0) {
  const rects = await bayRects(page);
  const r = rects[index] || rects[0];
  if (!r) throw new Error("no bay");
  await page.mouse.click(r.cx, r.cy);
  return { n: rects.length, r };
}

async function setMethod(page: import("playwright").Page, x: boolean, y: boolean) {
  const labelX = page.locator("label").filter({ hasText: /^Phương X$/ }).first();
  const labelY = page.locator("label").filter({ hasText: /^Phương Y$/ }).first();
  await labelX.scrollIntoViewIfNeeded();
  const cbX = labelX.locator("button").first();
  const cbY = labelY.locator("button").first();
  const sx = (await cbX.getAttribute("data-state")) === "checked";
  const sy = (await cbY.getAttribute("data-state")) === "checked";
  if (sx !== x) await cbX.click();
  if (sy !== y) await cbY.click();
}

async function ensureInsertOff(page: import("playwright").Page) {
  const hint = page.getByText(/Đang chèn/);
  if (await hint.count()) {
    await page.locator("button").filter({ hasText: "Chèn dầm" }).click();
    await page.waitForTimeout(200);
  }
}

async function statusHas(page: import("playwright").Page, re: RegExp) {
  const t = await page.locator("body").innerText();
  return re.test(t);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // Tab trục: đặt 2 trục X, 2 trục Y → 1 ô
  await page.getByRole("button", { name: /2\.\s*Trục/ }).click().catch(() => {});
  await page.waitForTimeout(200);
  // Thử nhập số trục nếu có
  const axisInputs = page.locator('input[type="number"]');
  // Fallback: dùng sample, chỉ assert tăng ô + status «tách thành»

  await page.getByRole("button", { name: "3. Số liệu dầm" }).click();
  await page.waitForTimeout(300);
  await page.getByText("Danh sách dầm").scrollIntoViewIfNeeded();

  const before = await bayRects(page);
  console.log(
    "before",
    before.length,
    before.map((b) => `${Math.round(b.w)}x${Math.round(b.h)}`),
  );
  await page.screenshot({ path: path.join(OUT, "split-01-before.png") });

  await selectFirstType(page);
  await ensureInsertOff(page);
  await setMethod(page, true, false);

  await page.locator("button").filter({ hasText: "Chèn dầm" }).click();
  await page.waitForTimeout(200);
  await clickBayAt(page, 0);
  await page.waitForTimeout(700);

  const afterX = await bayRects(page);
  const okX = await statusHas(page, /tách thành\s+\d+×\d+\s+ô độc lập/);
  console.log(
    "after X",
    afterX.length,
    okX,
    afterX.map((b) => `${Math.round(b.w)}x${Math.round(b.h)}`),
  );
  await page.screenshot({ path: path.join(OUT, "split-02-after-x.png") });
  if (afterX.length <= before.length) throw new Error(`X should increase bays ${before.length}→${afterX.length}`);
  if (!okX) throw new Error("missing tách thành status after X");

  await ensureInsertOff(page);
  await selectFirstType(page);
  await setMethod(page, false, true);
  await page.locator("button").filter({ hasText: "Chèn dầm" }).click();
  await page.waitForTimeout(200);
  await clickBayAt(page, 0);
  await page.waitForTimeout(700);

  const afterY = await bayRects(page);
  const okY = await statusHas(page, /tách thành\s+\d+×\d+\s+ô độc lập/);
  console.log(
    "after Y",
    afterY.length,
    okY,
    afterY.map((b) => `${Math.round(b.w)}x${Math.round(b.h)}`),
  );
  await page.screenshot({ path: path.join(OUT, "split-03-after-xy.png") });
  if (afterY.length <= afterX.length) throw new Error(`Y should increase bays ${afterX.length}→${afterY.length}`);
  if (!okY) throw new Error("missing tách thành status after Y");

  // Selection: click từng ô — highlight không phủ hết như 1 ô lớn
  const heights = new Set<number>();
  const widths = new Set<number>();
  for (let i = 0; i < Math.min(afterY.length, 6); i++) {
    await ensureInsertOff(page);
    await clickBayAt(page, i);
    await page.waitForTimeout(150);
    const sel = await page.evaluate(() => {
      const active = [...document.querySelectorAll("svg rect")].find((el) =>
        (el.getAttribute("fill") || "").includes("56,189,248"),
      );
      if (!active) return null;
      const b = active.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    });
    if (sel) {
      widths.add(sel.w);
      heights.add(sel.h);
    }
    console.log("sel", i, sel);
  }
  await page.screenshot({ path: path.join(OUT, "split-04-independent-select.png") });
  console.log("unique W/H", [...widths], [...heights]);
  if (heights.size < 2 && widths.size < 2) {
    throw new Error("expected independent sub-bays with different selection sizes");
  }

  await browser.close();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
