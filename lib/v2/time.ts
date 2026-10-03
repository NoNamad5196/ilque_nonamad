export function dateKey(input: Date | string, timeZone = "Asia/Seoul"): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(input));
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}
export function addDays(day: string, count: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function dayDistance(a: string, b: string) {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
}
export function weekKey(day: string) {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}
/** Resolve a wall-clock instant without depending on the server timezone (including DST). */
export function zonedInstant(day: string, clock: string, zone: string): Date {
  const target = Date.parse(`${day}T${clock}:00Z`);
  let guess = target;
  for (let n = 0; n < 4; n++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const part = (k: string) => parts.find((p) => p.type === k)!.value;
    const observed = Date.parse(
      `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}Z`,
    );
    const delta = target - observed;
    if (!delta) return new Date(guess);
    guess += delta;
  }
  return new Date(guess);
}
export function clockLabel(iso?: string, zone = "Asia/Seoul") {
  return iso
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(iso))
    : "시간 미배정";
}
