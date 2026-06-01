const IST = 'Asia/Kolkata';

/** YYYY-MM-DD in IST (en-CA locale). */
export function istTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());
}

/** YYYY-MM-DD in IST, n calendar days before today in IST. */
export function istYmdDaysAgo(n: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  const utc = new Date(Date.UTC(y, m - 1, d - n));
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(utc);
}

/** First day of current month in IST. */
export function istMonthStartYmd(): string {
  const today = istTodayYmd();
  return `${today.slice(0, 7)}-01`;
}

export function formatIstRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'All time';
  if (from && to) return `${from} → ${to} (IST)`;
  if (from) return `From ${from} (IST)`;
  return `Through ${to} (IST)`;
}
