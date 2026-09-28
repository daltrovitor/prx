// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { readMemoryMedia } from "@/lib/reels/repository";

/**
 * GET /api/reels/media/:id — vídeo ou capa enviados sem o Supabase Storage
 * (desenvolvimento). Suporta Range, exigido pelo Safari para tocar vídeo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = /^[0-9a-f-]{36}$/i.test(id) ? readMemoryMedia(id) : null;
  if (!media) return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });

  const size = media.data.byteLength;
  const headers = {
    "Content-Type": media.type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) return new NextResponse(new Uint8Array(media.data), { status: 200, headers: { ...headers, "Content-Length": String(size) } });

  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2] || 0));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (!(start <= end) || start >= size) {
    return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  return new NextResponse(new Uint8Array(media.data.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
