import { format } from "date-fns"

// Calendar days (release date, last completion) are Dates at that day's UTC midnight, stored as epoch milliseconds.
// They're always read back through their UTC parts, so every device shows the same day whatever its local time zone.

export const DISPLAY_DATE_FORMAT = "yyyy-MMM-dd"

// A day picked in the local calendar UI → that day's UTC midnight
export const toUtcDay = (local: Date) => new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()))

// A stored day → a local Date on the same calendar day, for calendar UIs and date-fns formatting
export const fromUtcDay = (day: Date) => new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())

export const formatDay = (day: Date, pattern = DISPLAY_DATE_FORMAT) => format(fromUtcDay(day), pattern)
