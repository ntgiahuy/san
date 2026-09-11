import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  className,
  unit,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Đơn vị hiển thị sau ô nhập (vd. mm). */
  unit?: string;
  /** Ô nhập rộng hơn (tên, ghi chú…). Mặc định full-width trong cột. */
  wide?: boolean;
}) {
  return (
    <label className={cn("flex w-full min-w-0 flex-col gap-1", className)}>
      <span className="text-[12px] leading-tight text-zinc-400">{label}</span>
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <div
          className={cn(
            "min-w-0 [&_input]:w-full [&_select]:w-full",
            wide === false ? "w-auto" : "flex-1",
          )}
        >
          {children}
        </div>
        {unit ? <span className="shrink-0 text-[12px] text-zinc-400">{unit}</span> : null}
      </div>
    </label>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3",
        className,
      )}
    >
      <h2 className="mb-2 text-sm font-semibold text-sky-300">{title}</h2>
      {children}
    </section>
  );
}
