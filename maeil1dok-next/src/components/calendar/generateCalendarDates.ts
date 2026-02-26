export interface CalendarDate {
  date: Date
  dateStr: string
  isCurrentMonth: boolean
  isToday: boolean
}

function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateCalendarDates(year: number, month: number): CalendarDate[] {
  const normalizedMonth = Math.min(Math.max(month, 1), 12)
  const monthIndex = normalizedMonth - 1
  const firstDay = new Date(year, monthIndex, 1)
  const firstGridDate = new Date(firstDay)
  firstGridDate.setDate(firstDay.getDate() - firstDay.getDay())

  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate)
    date.setDate(firstGridDate.getDate() + index)

    return {
      date,
      dateStr: toDateString(date),
      isCurrentMonth: date.getMonth() === monthIndex,
      isToday:
        date.getFullYear() === todayYear && date.getMonth() === todayMonth && date.getDate() === todayDate,
    }
  })
}
