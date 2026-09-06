/** Gedeelde formulierhulpjes voor de admin server actions (AD 1.3, koude review N-1): één UUID-check, één FormState. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const ids = (formData: FormData, key: string): string[] => formData.getAll(key).map(String).filter((s) => UUID_RE.test(s));
export interface FormState { error: string | null; saved: boolean }
