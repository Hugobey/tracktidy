export function handleCheckPro(
  emailRaw: unknown,
  secret: string | undefined,
  fetchImpl?: typeof fetch,
): Promise<{ status: number; body: { pro: boolean; error?: string } }>;
