// @ts-nocheck
// Rate limiting helpers for the generate-questions edge function.

export const MAX_SCANS_PER_DAY = 20;

export function parseJwtUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
