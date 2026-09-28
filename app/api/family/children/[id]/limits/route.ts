// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { limitsSchema } from "@/lib/family/types";
import { setLimits } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

/** Limites de gasto do cartão e do Pix do filho (por compra, por dia e por mês). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const { id } = await params;
    const parsed = limitsSchema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    return NextResponse.json({ success: true, limits: await setLimits(parent, id, parsed.data) });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível salvar os limites.");
  }
}
