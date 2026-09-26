/**
 * Mặt cắt: thép dọc xuyên dầm liên tục; biên / ô thủng / lệch drop → neo + cover.
 */
import { buildSectionLongRebarRuns, type SectionLongRebarRun } from "./lib/pdf/generate";

type Seg =
  | { kind: "beam"; lo: number; hi: number; h: number; name: string }
  | { kind: "slab"; lo: number; hi: number; drop: number; label?: string }
  | { kind: "opening"; lo: number; hi: number; label?: string };

function runKey(r: SectionLongRebarRun) {
  return {
    lo: Math.round(r.loMm),
    hi: Math.round(r.hiMm),
    drop: r.drop,
    L: r.leftTerm,
    R: r.rightTerm,
  };
}

function main() {
  const cover = 25;
  // [dầm biên][sàn][dầm giữa][sàn][dầm biên]
  const cont: Seg[] = [
    { kind: "beam", lo: 0, hi: 200, h: 500, name: "D1" },
    { kind: "slab", lo: 200, hi: 3700, drop: 0 },
    { kind: "beam", lo: 3700, hi: 3900, h: 500, name: "D2" },
    { kind: "slab", lo: 3900, hi: 7600, drop: 0 },
    { kind: "beam", lo: 7600, hi: 7800, h: 500, name: "D3" },
  ];
  const r1 = buildSectionLongRebarRuns(cont, cover);
  if (r1.length !== 1) {
    console.error("FAIL expected 1 continuous run", r1.map(runKey));
    process.exit(1);
  }
  // Thụt ~0.4 B (=80mm với dầm 200) — lớn hơn cover để thấy trên TL
  const pen = 80;
  if (
    !(
      Math.round(r1[0]!.loMm) === pen &&
      Math.round(r1[0]!.hiMm) === 7800 - pen &&
      r1[0]!.leftTerm &&
      r1[0]!.rightTerm
    )
  ) {
    console.error("FAIL continuous through mid beam with edge terms", runKey(r1[0]!));
    process.exit(1);
  }
  // Dầm giữa nằm trong [lo,hi] → nét xuyên thân
  if (!(r1[0]!.loMm < 3700 && r1[0]!.hiMm > 3900)) {
    console.error("FAIL run does not span mid beam", runKey(r1[0]!));
    process.exit(1);
  }

  // [dầm][sàn][dầm][ô thủng]
  const open: Seg[] = [
    { kind: "beam", lo: 0, hi: 200, h: 500, name: "D1" },
    { kind: "slab", lo: 200, hi: 3700, drop: 0 },
    { kind: "beam", lo: 3700, hi: 3900, h: 500, name: "D2" },
    { kind: "opening", lo: 3900, hi: 7600, label: "O1" },
  ];
  const r2 = buildSectionLongRebarRuns(open, cover);
  if (r2.length !== 1 || !r2[0]!.rightTerm || Math.round(r2[0]!.hiMm) !== 3900 - pen) {
    console.error("FAIL opening termination", r2.map(runKey));
    process.exit(1);
  }

  // [sàn cao][dầm][sàn thấp cắt] — hai dải neo vào cùng dầm
  const step: Seg[] = [
    { kind: "beam", lo: 0, hi: 200, h: 500, name: "D1" },
    { kind: "slab", lo: 200, hi: 3700, drop: 0 },
    { kind: "beam", lo: 3700, hi: 3900, h: 500, name: "D2" },
    { kind: "slab", lo: 3900, hi: 7600, drop: 50 },
    { kind: "beam", lo: 7600, hi: 7800, h: 500, name: "D3" },
  ];
  const r3 = buildSectionLongRebarRuns(step, cover);
  if (r3.length !== 2) {
    console.error("FAIL expected 2 runs at cut step", r3.map(runKey));
    process.exit(1);
  }
  const hi = r3.find((r) => r.drop === 0)!;
  const lo = r3.find((r) => r.drop === 50)!;
  if (!hi?.rightTerm || Math.round(hi.hiMm) !== 3900 - pen) {
    console.error("FAIL high side into step beam", runKey(hi));
    process.exit(1);
  }
  if (!lo?.leftTerm || Math.round(lo.loMm) !== 3700 + pen) {
    console.error("FAIL low side into step beam", runKey(lo));
    process.exit(1);
  }

  console.log("OK section long rebar runs", {
    cont: runKey(r1[0]!),
    open: runKey(r2[0]!),
    step: r3.map(runKey),
  });
}

main();
