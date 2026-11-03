// Chicago-time display strings for the minimal Admin screens (decision queue
// 2026-11-03 11:56:14). The server formats every time once and passes only the
// string to the browser, so server and browser markup always agree. ASCII
// only: the narrow and ordinary no-break spaces some Intl data puts before
// AM/PM become plain spaces.

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

function ascii(text: string): string {
  return text.replace(/\s/g, " ");
}

// A moment, for example "Nov 3, 2026, 11:05 AM CST". Throws on a bad value.
export function formatAdminChicagoTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error("admin_time_invalid");
  return ascii(TIME.format(new Date(ms)));
}

// A Chicago calendar day as the database stores it ("2026-11-03"), for
// example "Nov 3, 2026". Throws on a bad value.
export function formatAdminChicagoDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("admin_day_invalid");
  const ms = Date.parse(`${day}T12:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== day) throw new Error("admin_day_invalid");
  return ascii(DAY.format(new Date(ms)));
}
