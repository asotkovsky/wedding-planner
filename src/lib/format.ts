// `date` columns come back as "YYYY-MM-DD"; format without shifting through the local timezone.
export function formatDate(isoDate: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function daysUntil(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
}
