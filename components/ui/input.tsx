import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-7 w-full max-w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 py-0.5 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
        className,
      )}
      {...props}
    />
  );
}
