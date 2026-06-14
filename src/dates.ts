import { badRequest } from './errors.js';

const RELATIVE_RE = /^-(\d+)([hdwm])$/;

const UNIT_MS: Record<string, number> = {
  h: 3600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
};

/**
 * Parse a Query DSL date: relative ('-30d', '-12h', '-4w', '-3m') or ISO 8601.
 * Months are calendar months, not 30-day approximations.
 */
export function parseDateInput(input: string, now: Date = new Date()): Date {
  const rel = RELATIVE_RE.exec(input.trim());
  if (rel) {
    const amount = Number(rel[1]);
    const unit = rel[2]!;
    if (unit === 'm') {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - amount);
      return d;
    }
    return new Date(now.getTime() - amount * UNIT_MS[unit]!);
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(
      'invalid_date',
      `cannot parse date "${input}"`,
      'use a relative date like "-30d" (-12h, -4w, -3m) or an ISO 8601 timestamp',
    );
  }
  return parsed;
}
