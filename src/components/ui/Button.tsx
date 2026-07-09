import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "light";

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.95rem] font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-wine text-paper shadow-[0_10px_30px_-12px_rgba(151,27,34,0.7)] hover:bg-wine-dark hover:shadow-[0_16px_40px_-14px_rgba(151,27,34,0.85)] hover:-translate-y-0.5",
  outline:
    "border border-ink/25 text-ink hover:border-wine hover:text-wine hover:-translate-y-0.5",
  ghost: "text-ink hover:text-wine",
  light:
    "border border-paper/40 text-paper hover:bg-paper hover:text-ink hover:-translate-y-0.5",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: { variant?: Variant; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  children,
  ...props
}: { variant?: Variant; children: ReactNode } & ComponentProps<"a">) {
  return (
    <a className={cn(base, variants[variant], className)} {...props}>
      {children}
    </a>
  );
}
