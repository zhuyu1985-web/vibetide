"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Extra classes for the inner <Input> (e.g. `h-8 text-xs` for compact variants). */
  inputClassName?: string;
};

/**
 * Canonical search input for Vibetide.
 *
 * Every dashboard page used to hand-write `<div className="relative"><Search
 * absolute left-2.5/3.../><Input pl-8 .../></div>` with slightly different
 * icon sizes (14/15/16), left offsets, and colors. This component locks
 * those in so all search boxes look the same.
 *
 * The `className` prop goes on the wrapper (use it for width / positioning);
 * `inputClassName` forwards to the inner Input (use it for size variants).
 *
 * Usage:
 *   <SearchInput placeholder="搜索..." value={q} onChange={e => setQ(e.target.value)} />
 *   <SearchInput className="w-60" inputClassName="h-8 text-xs" ... />
 */
export function SearchInput({
  className,
  inputClassName,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500"
      />
      <Input
        type="search"
        className={cn("pl-8 w-full", inputClassName)}
        {...props}
      />
    </div>
  );
}
