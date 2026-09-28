// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { allowanceSchema } from "@/lib/family/types";
import { cancelAllowance, setAllowance } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

/** Mesada automática (semanal ou mensal, às 09:00 de Brasília). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const { id } = await params;
    const parsed = allowanceSchema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    return NextResponse.json({ success: true, allowance: await setAllowance(parent, id, parsed.data) });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível salvar a mesada.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const { id } = await params;
    await cancelAllowance(parent, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível cancelar a mesada.");
  }
}
