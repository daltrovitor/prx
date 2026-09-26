// Hello World
"use client";

import { useState, type ChangeEvent } from "react";
import Image from "next/image";
import { IconImage, IconUpload } from "@/components/icons/prx-icons";

/** Envia a imagem para o bucket do Supabase Storage e devolve a URL pública. */
export function useImageUpload(onUploaded: (url: string) => void, onError: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>, type: "logo" | "banner") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("type", type);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) onError(data.error || "Falha no envio da imagem.");
      else onUploaded(data.url);
    } catch {
      onError("Falha no envio da imagem.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, upload };
}

export function ImagePicker({
  label,
  value,
  busy,
  onChange,
  square = false,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  square?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <label className="mt-1.5 flex min-h-20 cursor-pointer items-center gap-4 border border-dashed border-input p-3 transition-colors hover:border-ink">
        <span className={`relative shrink-0 overflow-hidden bg-surface ${square ? "h-14 w-14" : "h-14 w-24"}`}>
          {value ? (
            <Image src={value} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <IconImage size={18} />
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-sm text-ink">
          <IconUpload size={16} />
          {busy ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}
        </span>
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={onChange} />
      </label>
    </div>
  );
}
