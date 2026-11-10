export const schedulesTabs = [
  "schedules",
  "triggers",
  "calendar",
  "runs",
] as const
export type SchedulesTab = (typeof schedulesTabs)[number]

export function isSchedulesTab(v: string | undefined): v is SchedulesTab {
  return schedulesTabs.includes(v as SchedulesTab)
}
