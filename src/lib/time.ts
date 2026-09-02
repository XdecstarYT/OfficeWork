/** Small shared time-formatting helpers used across the work/inbox/archive
 * pages so "how long ago" and "how soon" read consistently everywhere. */

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth}mo ago`;
}

/** For a due date: "due in 2d", "due today", or "3d overdue". */
export function dueLabel(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDay);
    return overdueDays === 0 ? "overdue" : `${overdueDays}d overdue`;
  }
  if (diffDay === 0) return "due today";
  if (diffDay === 1) return "due tomorrow";
  return `due in ${diffDay}d`;
}

export function isDueSoon(iso: string, withinHours = 48): boolean {
  const diffMs = new Date(iso).getTime() - Date.now();
  return diffMs > 0 && diffMs <= withinHours * 3_600_000;
}
