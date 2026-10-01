// Hello World
import { describe, expect, it } from "vitest";
import {
  PRX_COMPRESSED_PREFIX,
  compressImageDataUrl,
  decompressImageData,
  decompressImageDataSync,
  getCompressedMimeType,
  isCompressedImageData,
} from "@/lib/media/compression";

describe("PRX Image Compression & Decompression", () => {
  it("identifica corretamente strings comprimidas", () => {
    expect(isCompressedImageData("prx:gz:image/webp;base64,ABC123")).toBe(true);
    expect(isCompressedImageData("https://example.com/foto.jpg")).toBe(false);
    expect(isCompressedImageData("data:image/png;base64,AAA")).toBe(false);
    expect(isCompressedImageData(null)).toBe(false);
    expect(isCompressedImageData(undefined)).toBe(false);
  });

  it("extrai tipo MIME do payload compactado", () => {
    expect(getCompressedMimeType("prx:gz:image/webp;base64,123")).toBe("image/webp");
    expect(getCompressedMimeType("prx:gz:image/jpeg;base64,456")).toBe("image/jpeg");
    expect(getCompressedMimeType("https://example.com/logo.png")).toBe("image/webp");
  });

  it("compacta e descompacta data URL assincronamente preservando integridade exata", async () => {
    const rawPayload = "A".repeat(5000);
    const originalDataUrl = `data:image/webp;base64,${rawPayload}`;

    const compressed = await compressImageDataUrl(originalDataUrl);

    expect(compressed.startsWith(PRX_COMPRESSED_PREFIX)).toBe(true);
    expect(compressed.length).toBeLessThan(originalDataUrl.length);

    const decompressed = await decompressImageData(compressed);
    expect(decompressed).toBe(originalDataUrl);
  });

  it("descompacta síncronamente no ambiente do servidor / SSR", async () => {
    const originalDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const compressed = await compressImageDataUrl(originalDataUrl);
    expect(isCompressedImageData(compressed)).toBe(true);

    const decompressedSync = decompressImageDataSync(compressed);
    expect(decompressedSync).toBe(originalDataUrl);
  });

  it("ignora URLs regulares e as devolve sem alteração", async () => {
    const regularUrl = "https://cdn.prx.com.br/benefits/banner.webp";
    const compressedResult = await compressImageDataUrl(regularUrl);
    expect(compressedResult).toBe(regularUrl);

    const decompressedResult = await decompressImageData(regularUrl);
    expect(decompressedResult).toBe(regularUrl);

    const syncResult = decompressImageDataSync(regularUrl);
    expect(syncResult).toBe(regularUrl);
  });

  it("trata payloads inválidos com fallback seguro sem lançar exceções", async () => {
    const malformed = "prx:gz:invalid-payload-without-separator";
    const result = await decompressImageData(malformed);
    expect(result).toBe(malformed);

    const syncResult = decompressImageDataSync(malformed);
    expect(syncResult).toBe(malformed);
  });
});
