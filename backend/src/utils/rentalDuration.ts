const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TIME_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

function stripInvisible(s: string): string {
  return s.replace(/[\u00a0\u202f\u2007\u2009\u2060\ufeff]/g, '').trim();
}

function normalizeTimeString(time?: string | null): string | null {
  if (time == null) return null;
  const raw = stripInvisible(String(time));
  if (!raw) return null;
  if (TIME_REGEX.test(raw)) {
    return raw.length === 5 ? `${raw}:00` : raw;
  }
  const dotMatch = raw.match(/^(\d{1,2})\.(\d{2})(?:\.(\d{2}))?$/);
  if (dotMatch) {
    const h = String(Number(dotMatch[1])).padStart(2, '0');
    const m = dotMatch[2];
    const s = dotMatch[3] ?? '00';
    return `${h}:${m}:${s}`;
  }
  const loose = raw.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
  if (loose) {
    const h = String(Number(loose[1])).padStart(2, '0');
    const m = loose[2];
    const s = loose[3] ?? '00';
    return `${h}:${m}:${s}`;
  }
  return null;
}

function parseDateTime(date?: string | null, time?: string | null): Date | null {
  const dRaw = date == null ? '' : stripInvisible(String(date));
  if (!dRaw) return null;
  const normTime = normalizeTimeString(time) ?? '00:00:00';
  const parsed = new Date(`${dRaw}T${normTime}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Calculates the rental duration in days between handover and return.
 * Each started 24h period counts as a full day (Math.ceil semantics).
 * Returns null when the timestamps cannot be parsed.
 */
export function calculateRentalFullDays(
  handoverDate?: string | null,
  handoverTime?: string | null,
  returnDate?: string | null,
  returnTime?: string | null,
): number | null {
  const handoverDt = parseDateTime(handoverDate, handoverTime);
  const returnDt = parseDateTime(returnDate, returnTime);
  if (!handoverDt || !returnDt) return null;

  const diffMs = returnDt.getTime() - handoverDt.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / MS_PER_DAY);
}
