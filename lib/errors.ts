// Hello World

/** Mensagem legível de um erro desconhecido (catch sem `any`). */
export function errorMessage(err: unknown, fallback = ""): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}
