/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Belgian Time Utility Service (Huidcentrum Gent)
 * 
 * Guarantees uniform time and date formatting in the 'Europe/Brussels' timezone
 * across all devices: desktop PCs, kiosk tablets, mobile phones, and remote servers.
 * Prevents timezone offset bugs (e.g. 8-9h discrepancy when running in PST/UTC containers).
 */

export const BELGIAN_TIMEZONE = 'Europe/Brussels';

/**
 * Returns the current date formatted as 'YYYY-MM-DD' in Belgian local time.
 */
export function getBelgianDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: BELGIAN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    // Fallback if Intl fails
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Formats a Date or ISO string to 'HH:mm' in Belgian local time (Europe/Brussels).
 * If invalid or null, returns fallback ('--:--').
 */
export function formatBelgianTimeHM(dateOrIso?: string | Date | null, fallback = '--:--'): string {
  if (!dateOrIso) return fallback;
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('nl-BE', {
      timeZone: BELGIAN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  } catch {
    return fallback;
  }
}

/**
 * Formats a Date or ISO string to 'HH:mm:ss' in Belgian local time (Europe/Brussels).
 * Used for live digital clocks.
 */
export function formatBelgianTimeHMS(dateOrIso?: string | Date | null, fallback = '--:--:--'): string {
  if (!dateOrIso) return fallback;
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('nl-BE', {
      timeZone: BELGIAN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d);
  } catch {
    return fallback;
  }
}

/**
 * Returns the current Belgian hour (0 - 23).
 * Used for appropriate day greeting (Goedemorgen, Goedemiddag, Goedenavond).
 */
export function getBelgianHour(date: Date = new Date()): number {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: BELGIAN_TIMEZONE,
      hour: 'numeric',
      hour12: false
    }).format(date);
    const parsed = parseInt(hourStr, 10);
    return isNaN(parsed) ? date.getHours() : (parsed === 24 ? 0 : parsed);
  } catch {
    return date.getHours();
  }
}

/**
 * Formats a date to full Dutch text in Europe/Brussels.
 * E.g., 'maandag 30 maart 2026'
 */
export function formatBelgianFullDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('nl-BE', {
      timeZone: BELGIAN_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch {
    return date.toLocaleDateString('nl-BE');
  }
}

/**
 * Formats a date to short Dutch text in Europe/Brussels.
 * E.g., 'ma 30 mrt'
 */
export function formatBelgianShortDate(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return '-';
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('nl-BE', {
      timeZone: BELGIAN_TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Accurately parses a Belgian local date (YYYY-MM-DD) and time (HH:mm) into a UTC ISO string.
 * Accounts for Belgian daylight saving (CET UTC+1 vs CEST UTC+2) without being affected
 * by the local client/server machine timezone.
 */
export function parseBelgianDateTimeToIso(dateStr: string, timeStr: string): string {
  try {
    const cleanTime = timeStr.trim().length === 5 ? `${timeStr.trim()}:00` : timeStr.trim();
    // Start with a UTC assumption
    const naiveUtc = new Date(`${dateStr}T${cleanTime}Z`);
    if (isNaN(naiveUtc.getTime())) {
      return new Date().toISOString();
    }

    // Determine Europe/Brussels representation of naiveUtc
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: BELGIAN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(naiveUtc);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const brusselsHour = map.hour === '24' ? '00' : map.hour;
    const brusselsIso = `${map.year}-${map.month}-${map.day}T${brusselsHour}:${map.minute}:${map.second}Z`;
    const brusselsMs = new Date(brusselsIso).getTime();
    const offsetMs = brusselsMs - naiveUtc.getTime();

    // Actual UTC timestamp for this Belgian local time:
    const actualUtcMs = naiveUtc.getTime() - offsetMs;
    return new Date(actualUtcMs).toISOString();
  } catch {
    return new Date(`${dateStr}T${timeStr}`).toISOString();
  }
}
