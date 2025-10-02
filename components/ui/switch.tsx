import { ComponentPropsWithoutRef, forwardRef } from "react";

import { cn } from "@/lib/utils";

type SwitchProps = ComponentPropsWithoutRef<"button"> & {
  checked?: boolean;
  label?: string;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, label, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-sm transition hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700",
        checked ? "bg-brand-600 text-white" : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-100",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-7 items-center rounded-full transition",
          checked ? "bg-white/30" : "bg-slate-300 dark:bg-slate-600",
        )}
      >
        <span
          className={cn(
            "block h-3.5 w-3.5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  ),
);

Switch.displayName = "Switch";
