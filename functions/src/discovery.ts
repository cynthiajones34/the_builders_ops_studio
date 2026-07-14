// Discovery-call journey: shared constants and the time math for the greeting
// deadline and the 24h/12h intake reminders. Pure functions so the money path
// (when a prospect gets emailed) has a runnable self-check at the bottom.

export const INTAKE_FORM_URL = "https://forms.gle/q9o47P3cpjromC1S9";
const TZ = "America/New_York";

// Hours between now and an ISO datetime. Negative once the call has passed.
export function hoursUntil(iso: string, now: Date = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000;
}

// Which reminder (if any) is due, honouring the already-sent flags so an hourly
// cron never double-sends. ~1h windows centred on 24h and 12h before the call.
export function dueReminder(hrs: number, sent24: boolean, sent12: boolean): "24h" | "12h" | null {
  if (!sent24 && hrs >= 23.5 && hrs <= 24.5) return "24h";
  if (!sent12 && hrs >= 11.5 && hrs <= 12.5) return "12h";
  return null;
}

// "today" or "tomorrow" for the reminder copy, compared in ET. "soon" if the
// call is further out or the date is unparseable.
export function todayOrTomorrow(iso: string, now: Date = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TZ });
  const call = new Date(iso);
  if (isNaN(call.getTime())) return "soon";
  if (day(call) === day(now)) return "today";
  if (day(call) === day(new Date(now.getTime() + 24 * 3_600_000))) return "tomorrow";
  return "soon";
}

// Deadline clause for the greeting: noon the weekday before the call, e.g.
// "by noon on Wednesday". Falls back to "before our call" when the day before
// lands on a weekend (or the date is bad), so the sentence always reads right.
export function intakeDeadlineClause(iso: string): string {
  const call = new Date(iso);
  if (isNaN(call.getTime())) return "before our call";
  const dayBefore = new Date(call.getTime() - 24 * 3_600_000);
  const weekday = dayBefore.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long" });
  if (weekday === "Saturday" || weekday === "Sunday") return "before our call";
  return `by noon on ${weekday}`;
}

// ponytail: self-check, run with `node lib/discovery.js` after build.
if (require.main === module) {
  const assert = require("assert");
  assert.strictEqual(dueReminder(24.0, false, false), "24h");
  assert.strictEqual(dueReminder(24.0, true, false), null); // already sent
  assert.strictEqual(dueReminder(12.0, false, false), "12h");
  assert.strictEqual(dueReminder(12.0, false, true), null); // already sent
  assert.strictEqual(dueReminder(6, false, false), null); // outside windows
  assert.strictEqual(intakeDeadlineClause("not-a-date"), "before our call");
  const now = new Date("2026-07-02T09:00:00-04:00");
  assert.strictEqual(todayOrTomorrow("2026-07-02T14:00:00-04:00", now), "today");
  assert.strictEqual(todayOrTomorrow("2026-07-03T10:00:00-04:00", now), "tomorrow");
  assert.strictEqual(todayOrTomorrow("2026-07-20T10:00:00-04:00", now), "soon");
  console.log("discovery.ts self-check passed");
}
