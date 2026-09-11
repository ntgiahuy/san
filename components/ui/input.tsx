import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  const isNumber = props.type === "number";
  return (
    <input
      className={cn(
        "flex h-7 shrink-0 rounded-md border border-zinc-600 bg-zinc-950 px-2 py-0.5 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
        isNumber ? "w-[4.75rem]" : "w-28 max-w-full",
        className,
      )}
      {...props}
    />
  );
}
