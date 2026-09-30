// Hello World
"use client";

import { cn } from "@/lib/utils";
import { PASSWORD_MISMATCH, PASSWORD_RULES } from "@/lib/password-policy";

/**
 * As regras da senha marcadas enquanto a pessoa digita (e a confirmação, quando
 * informada). Herda a cor do texto do pai: funciona na landing e no app.
 */
export function PasswordChecklist({ password, confirm, className }: { password: string; confirm?: string; className?: string }) {
  const items = PASSWORD_RULES.map((rule) => ({ key: rule.id, label: rule.label, ok: rule.test(password) }));
  if (confirm !== undefined) items.push({ key: "length", label: confirm && confirm !== password ? PASSWORD_MISMATCH : "Senhas iguais", ok: Boolean(confirm) && confirm === password });
  return (
    <ul aria-label="Requisitos da senha" className={cn("grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] min-[380px]:grid-cols-2", className)}>
      {items.map((item, i) => (
        <li key={`${item.key}-${i}`} className={cn("flex items-center gap-1.5", item.ok ? "text-emerald-600 dark:text-emerald-400" : "opacity-75")}>
          <span aria-hidden className="inline-flex w-3 justify-center font-semibold">
            {item.ok ? "✓" : "•"}
          </span>
          <span>
            {item.label}
            <span className="sr-only">{item.ok ? " (ok)" : " (falta)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
