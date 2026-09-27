import type { MemberStat, ProgressDay } from './contracts';

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekDates(today: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7 + index));
}
export function averageProgress(stats: readonly MemberStat[]): number | null {
  return stats.length ? Math.round(stats.reduce((sum, stat) => sum + stat.progress_rate, 0) / stats.length) : null;
}
export function weekState(
  calendar: Readonly<Record<string, ProgressDay>>,
  memberId: number,
  dates: { readonly day: string; readonly today: string },
): 'upcoming' | 'completed' | 'today' | 'pending' | 'unavailable' {
  if (dates.day > dates.today) return 'upcoming';
  const member = calendar[dates.day]?.members.find((entry) => entry.id === memberId);
  if (member?.is_completed) return 'completed';
  if (dates.day === dates.today) return 'today';
  return member ? 'pending' : 'unavailable';
}
