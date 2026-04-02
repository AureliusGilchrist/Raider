/**
 * Format a date for display as a divider in chat
 * Returns "Today", "Yesterday", or the full date
 */
export function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset time portions for comparison
  const dateNoTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayNoTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (dateNoTime.getTime() === todayNoTime.getTime()) {
    return 'Today';
  }
  if (dateNoTime.getTime() === yesterdayNoTime.getTime()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format a date as a relative time string (e.g. "3 minutes ago", "2 days ago")
 */
export function formatDistanceToNow(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Check if two messages are on different days
 */
export function isDifferentDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}
