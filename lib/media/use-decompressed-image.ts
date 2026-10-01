// Hello World
"use client";

import { useEffect, useState } from "react";
import type { StaticImageData } from "next/image";
import { decompressImageData, decompressImageDataSync, isCompressedImageData } from "@/lib/media/compression";

export type ImageSource = string | StaticImageData | null | undefined;

/**
 * Hook que resolve e descompacta transparentemente imagens gravadas no banco de dados.
 * Se a imagem estiver no padrão compactado (prx:gz:...), descompacta em segundo plano
 * e devolve a Data URL pronta para exibição imediata com cache instantâneo.
 */
export function useDecompressedImage(src: ImageSource): ImageSource {
  const isCompressed = typeof src === "string" && isCompressedImageData(src);

  // Se for síncrono ou já estiver em cache, resolve imediatamente sem flash
  const initial = isCompressed ? decompressImageDataSync(src) : src;
  const isResolved = initial !== src;

  const [resolved, setResolved] = useState<ImageSource>(isResolved ? initial : src);

  useEffect(() => {
    if (!isCompressed || typeof src !== "string") {
      setResolved(src);
      return;
    }

    let alive = true;
    void decompressImageData(src).then((url) => {
      if (alive) setResolved(url);
    });

    return () => {
      alive = false;
    };
  }, [src, isCompressed]);

  return resolved;
}
