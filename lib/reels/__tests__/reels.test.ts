// Hello World
import { beforeEach, describe, expect, it } from "vitest";
import { getPartnerRepository } from "@/lib/partners/repository";
import { partnerSnapshot } from "@/lib/partners/__tests__/fixtures";
import { resetReelsMemory } from "@/lib/reels/repository";
import { createReel, engage, memberFeed, updateReel } from "@/lib/reels/service";
import { reelInputSchema } from "@/lib/reels/types";

async function partner(status: "ATIVO" | "SUSPENSO" = "ATIVO") {
  return getPartnerRepository().insertPartner({
    ...partnerSnapshot,
    categoryId: "gastronomia",
    description: "",
    logoUrl: "",
    bannerUrl: "",
    status,
    ownerUserId: null,
    ownerEmail: null,
  });
}

const base = { title: "Drop de outono", videoUrl: "https://cdn.prx.app.br/reels/drop.mp4" };

describe("PRX Reels", () => {
  beforeEach(() => resetReelsMemory());

  it("valida o vídeo e o destino do botão", () => {
    expect(reelInputSchema.safeParse({ ...base, partnerId: "p" }).success).toBe(true);
    expect(reelInputSchema.safeParse({ ...base, partnerId: "p", videoUrl: "" }).success).toBe(false);
    expect(reelInputSchema.safeParse({ ...base, partnerId: "p", videoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(reelInputSchema.safeParse({ ...base, partnerId: "p", ctaKind: "external", ctaTarget: "http://loja" }).success).toBe(false);
    expect(reelInputSchema.safeParse({ ...base, partnerId: "p", ctaKind: "benefit" }).success).toBe(false);
  });

  it("mostra só vídeos ativos de parceiros sem bloqueio, com o rótulo padrão do botão", async () => {
    const active = await partner();
    const suspended = await partner("SUSPENSO");
    await createReel(reelInputSchema.parse({ ...base, partnerId: active.id }));
    await createReel(reelInputSchema.parse({ ...base, partnerId: suspended.id }));
    const hidden = await createReel(reelInputSchema.parse({ ...base, partnerId: active.id, title: "Oculto" }));
    await updateReel(hidden.id, reelInputSchema.parse({ ...base, partnerId: active.id, title: "Oculto", active: false }));

    const feed = await memberFeed("usr_a");
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ partnerName: "Café Aurora", ctaLabel: "Ver no Catálogo", liked: false });
  });

  it("conta cada curtida e salvo uma vez por membro", async () => {
    const owner = await partner();
    const reel = await createReel(reelInputSchema.parse({ ...base, partnerId: owner.id }));
    expect(await engage("usr_a", reel.id, "like")).toMatchObject({ likes: 1, liked: true });
    expect(await engage("usr_a", reel.id, "like")).toMatchObject({ likes: 1, liked: true });
    expect(await engage("usr_b", reel.id, "like")).toMatchObject({ likes: 2 });
    expect(await engage("usr_a", reel.id, "unlike")).toMatchObject({ likes: 1, liked: false });
    expect(await engage("usr_a", reel.id, "save")).toMatchObject({ saves: 1, saved: true });
    await expect(engage("usr_a", "nope", "view")).rejects.toThrow(/não encontrado/);
  });
});
