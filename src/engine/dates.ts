const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Readable calendar date. An empty or non-ISO value is returned unchanged. */
export function formatIsoDate(value: string | undefined): string {
  const iso = (value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/** Report header date from the draft timestamp, in UTC so the same file prints the same day. */
export function reportDateFromSaved(savedAt: string | undefined): { label: string; iso: string } {
  const parsed = savedAt ? new Date(savedAt) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { label: `${day} ${MONTHS[month]} ${year}`, iso };
}
