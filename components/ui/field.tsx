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
  /** Ô nhập rộng hơn (tên, ghi chú…). */
  wide?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1",
        className,
      )}
    >
      <span className="min-w-0 text-[12px] leading-tight text-zinc-400">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <div
          className={cn(
            "min-w-0",
            wide ? "w-[9.5rem] [&_input]:w-full [&_select]:w-full" : "w-[5.5rem] [&_input]:w-full [&_select]:w-full",
          )}
        >
          {children}
        </div>
        {unit ? <span className="w-7 shrink-0 text-[12px] text-zinc-400">{unit}</span> : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
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
