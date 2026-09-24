// Hello World
"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { IconClose } from "@/components/icons/prx-icons";

/* -------------------------------------------------------------------------- */
/* Botões                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "ink" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[3px] font-medium tracking-[-0.01em] cursor-pointer select-none " +
  "transition-[background-color,color,border-color,transform] duration-150 active:translate-y-px " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-[#5708c9]",
  ink: "bg-ink text-white hover:bg-[#23232c]",
  secondary: "bg-white text-ink border border-line hover:border-ink",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-white text-destructive border border-line hover:border-destructive",
};

const buttonSizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-5 text-[15px]",
  sm: "min-h-10 px-3.5 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], block && "w-full", className)}
      {...rest}
    />
  );
});

/** Botão só com ícone: área de toque de 48px e nome acessível obrigatório. */
export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-[3px] text-ink cursor-pointer transition-colors hover:bg-surface",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Formulários                                                                */
/* -------------------------------------------------------------------------- */

const controlBase =
  "w-full rounded-[3px] border border-input bg-white px-3.5 text-[15px] text-ink placeholder:text-[#8a8a96] " +
  "transition-colors hover:border-[#b9b9c4] focus:border-primary focus:outline-none focus-visible:outline-none " +
  "focus:ring-2 focus:ring-primary/20 disabled:bg-surface disabled:text-muted-foreground";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children(id, hintId)}
      {(hint || error) && (
        <p id={hintId} className={cn("text-[13px]", error ? "text-destructive" : "text-muted-foreground")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(controlBase, "h-12", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...rest },
  ref
) {
  return <select ref={ref} className={cn(controlBase, "h-12 cursor-pointer pr-8", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "min-h-24 py-3 resize-y", className)} {...rest} />;
  }
);

/* -------------------------------------------------------------------------- */
/* Painéis modais (sheet no mobile, diálogo centralizado no desktop)          */
/* -------------------------------------------------------------------------- */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}

export function Sheet({ open, onClose, title, description, children, footer, size = "md" }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" data-lenis-prevent>
          <motion.button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-ink/45 cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col bg-white outline-none",
              "rounded-t-[6px] sm:rounded-[4px] sm:border sm:border-line",
              size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-ink">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
              <IconButton label="Fechar" onClick={onClose} className="-mr-3 -mt-2 shrink-0">
                <IconClose size={20} />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && (
              <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Controle segmentado com indicador que desliza (layoutId)                   */
/* -------------------------------------------------------------------------- */

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  const groupId = useId();
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto scrollbar-none border-b border-line", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative min-h-12 shrink-0 px-3 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors",
              active ? "text-ink" : "text-muted-foreground hover:text-ink"
            )}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">{option.count}</span>
            )}
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-x-2 -bottom-px h-[2px] bg-ink"
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pequenos blocos                                                            */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  title,
  action,
  as: Heading = "h2",
  id,
  className,
}: {
  title: string;
  action?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <Heading id={id} className="font-display text-[22px] font-semibold leading-none tracking-[-0.03em] text-ink sm:text-2xl">
        {title}
      </Heading>
      {action}
    </div>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warning" | "ink"; className?: string }) {
  const tones = {
    neutral: "bg-surface text-muted-foreground",
    accent: "bg-primary/[0.08] text-primary",
    success: "bg-success/[0.09] text-success",
    warning: "bg-warning/[0.09] text-warning",
    ink: "bg-ink text-white",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[12px] font-medium leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, max = 100, label, tone = "accent" }: { value: number; max?: number; label: string; tone?: "accent" | "ink" | "success" }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const tones = { accent: "bg-primary", ink: "bg-ink", success: "bg-success" } as const;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className="h-1.5 w-full overflow-hidden bg-line"
    >
      <motion.div
        className={cn("h-full origin-left", tones[tone])}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
      />
    </div>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "success" | "error" | "warning"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "border-line bg-surface text-ink",
    success: "border-success/30 bg-success/[0.06] text-success",
    error: "border-destructive/30 bg-destructive/[0.05] text-destructive",
    warning: "border-warning/30 bg-warning/[0.06] text-warning",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("border-l-2 px-3.5 py-2.5 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Formatação monetária em reais com números tabulares. */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
