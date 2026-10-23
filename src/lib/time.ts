// Vremena se u bazi drže u UTC-u, a prikazuju u zoni turnira (Europe/Zagreb).

function offsetMinutes(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMillis));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMillis) / 60000);
}

/** '2026-10-23' + '16:00' u zoni turnira → ISO u UTC-u. */
export function zonedToIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - offsetMinutes(guess, timeZone) * 60000;
  // Drugi krug za dane promjene ljetnog računanja vremena.
  utc = guess - offsetMinutes(utc, timeZone) * 60000;
  return new Date(utc).toISOString();
}

/** Datum (YYYY-MM-DD) u zoni turnira. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

/** '16:00' u zoni turnira. */
export function localTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('hr-HR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(iso));
}

/** '16:00 – 16:25' */
export function timeRange(iso: string, minutes: number, timeZone: string): string {
  const end = new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
  return `${localTime(iso, timeZone)} – ${localTime(end, timeZone)}`;
}

const DAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
const DAYS_SHORT = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dm(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}. ${m}.`;
}

/** 'petak, 23. 10.' */
export function dayLabel(date: string): string {
  return `${DAYS[dayIndex(date)]}, ${dm(date)}`;
}

/** 'Pet 23. 10.' */
export function dayShort(date: string): string {
  return `${DAYS_SHORT[dayIndex(date)]} ${dm(date)}`;
}

/** '23. – 25. 10. 2026.' */
export function dateSpan(start: string, end: string): string {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (start === end) return `${ds}. ${ms}. ${ys}.`;
  if (ys === ye && ms === me) return `${ds}. – ${de}. ${me}. ${ye}.`;
  if (ys === ye) return `${ds}. ${ms}. – ${de}. ${me}. ${ye}.`;
  return `${ds}. ${ms}. ${ys}. – ${de}. ${me}. ${ye}.`;
}
