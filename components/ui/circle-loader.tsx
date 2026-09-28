// Hello World
"use client";

import { cn } from "@/lib/utils";

interface CircleLoaderProps {
  className?: string;
  size?: number;
  label?: string;
  minHeight?: string | number;
}

/**
 * Loader circular padrão e minimalista para transições e carregamento de telas/janelas nos dashboards.
 */
export function CircleLoader({
  className,
  size = 32,
  label = "Carregando...",
  minHeight = "360px",
}: CircleLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ minHeight }}
      className={cn("flex w-full flex-col items-center justify-center p-8", className)}
    >
      <div
        style={{ width: size, height: size }}
        className="animate-spin rounded-full border-2 border-black/10 border-t-primary dark:border-white/10 dark:border-t-primary"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
