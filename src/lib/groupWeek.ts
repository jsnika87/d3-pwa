// src/lib/groupWeek.ts
export function getCurrentWeekNumber(startDate: string) {
  // startDate should be "YYYY-MM-DD"
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}