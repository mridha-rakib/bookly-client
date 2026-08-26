export function getTimeOfDayGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatDashboardDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildDashboardSubtitle(name: string | undefined, now: Date = new Date()): string {
  const greeting = `${getTimeOfDayGreeting(now)}${name ? `, ${name}` : ""}`;
  return `${formatDashboardDate(now)} · ${greeting}`;
}
