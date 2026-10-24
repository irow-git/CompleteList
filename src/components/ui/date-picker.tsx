import * as React from "react"
import { DayPicker } from "react-day-picker"
import { addMonths, addYears, format, setMonth, setYear } from "date-fns"
import { ChevronLeft, ChevronRight } from "pixelarticons/react"

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { RemoveButton } from "@/components/ui/remove-button"
import { cn } from "@/lib/utils"
import { formatDay, fromUtcDay, toUtcDay } from "@/lib/dates"

type View = "date" | "month" | "year"

const headerButtonClass = "inline-flex h-10 min-w-[1.6em] cursor-pointer items-center justify-center text-white"
const gridCellClass = "inline-block h-6 w-[60px] cursor-pointer leading-6 hover:bg-white/10"
const gridSelectedClass = "bg-sand text-ink hover:bg-sand"

function CalendarPanel({
  value,
  month,
  onMonthChange,
  onSelect,
}: {
  value?: Date
  month: Date
  onMonthChange: (month: Date) => void
  onSelect: (date: Date) => void
}) {
  const [view, setView] = React.useState<View>("date")
  const year = month.getFullYear()
  const decadeStart = year - (year % 10)

  const superStep = (direction: 1 | -1) => onMonthChange(addYears(month, direction * (view === "year" ? 10 : 1)))

  return (
    <div className="border-l-[5px] border-l-sand">
      <div className="flex h-10 px-2">
        <button type="button" aria-label="Previous year" className={headerButtonClass} onClick={() => superStep(-1)}>
          <ChevronLeft className="size-3" />
          <ChevronLeft className="-ml-2 size-3" />
        </button>
        {view === "date" && (
          <button type="button" aria-label="Previous month" className={headerButtonClass} onClick={() => onMonthChange(addMonths(month, -1))}>
            <ChevronLeft className="size-3" />
          </button>
        )}
        <div className="flex-auto text-center leading-10 font-semibold">
          {view === "date" && (
            <button type="button" className="cursor-pointer font-pixel" onClick={() => setView("month")}>
              {format(month, "MMM")}
            </button>
          )}
          {view !== "year" ? (
            <button type="button" className="ml-2 cursor-pointer font-pixel first:ml-0" onClick={() => setView("year")}>
              {year}
            </button>
          ) : (
            <span className="font-pixel">
              {decadeStart}-{decadeStart + 9}
            </span>
          )}
        </div>
        {view === "date" && (
          <button type="button" aria-label="Next month" className={headerButtonClass} onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="size-3" />
          </button>
        )}
        <button type="button" aria-label="Next year" className={headerButtonClass} onClick={() => superStep(1)}>
          <ChevronRight className="size-3" />
          <ChevronRight className="-ml-2 size-3" />
        </button>
      </div>

      <div className="-ml-1.5 px-[18px] py-2">
        {view === "date" && (
          <DayPicker
            mode="single"
            selected={value}
            onSelect={(date) => date && onSelect(date)}
            month={month}
            onMonthChange={onMonthChange}
            hideNavigation
            showOutsideDays
            fixedWeeks
            formatters={{ formatWeekdayName: (date) => format(date, "EEEEEE") }}
            classNames={{
              root: "",
              months: "",
              month: "",
              month_caption: "sr-only",
              caption_label: "",
              month_grid: "w-full border-collapse",
              weekdays: "",
              weekday: "h-9 p-0 text-center font-normal",
              weeks: "",
              week: "",
              day: "p-0 py-1.5 text-center",
              day_button: "inline-block size-6 cursor-pointer leading-6 outline-none hover:bg-white/10 focus-visible:bg-white/10",
              outside: "text-[#8c8b8b]",
              selected: "[&>button]:bg-sand [&>button]:text-ink",
              today: "",
              hidden: "invisible",
            }}
          />
        )}

        {view === "month" && (
          <div className="grid h-[252px] grid-cols-3 items-center text-center">
            {Array.from({ length: 12 }, (_, index) => {
              const selected = value?.getFullYear() === year && value?.getMonth() === index
              return (
                <div key={index}>
                  <button
                    type="button"
                    className={cn(gridCellClass, selected && gridSelectedClass)}
                    onClick={() => {
                      onMonthChange(setMonth(month, index))
                      setView("date")
                    }}
                  >
                    {format(new Date(year, index), "MMM")}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {view === "year" && (
          <div className="grid h-[252px] grid-cols-3 items-center text-center">
            {Array.from({ length: 12 }, (_, index) => {
              const cellYear = decadeStart - 1 + index
              const outside = cellYear < decadeStart || cellYear > decadeStart + 9
              return (
                <div key={cellYear}>
                  <button
                    type="button"
                    className={cn(gridCellClass, outside && "text-[#8c8b8b]", value?.getFullYear() === cellYear && gridSelectedClass)}
                    onClick={() => {
                      onMonthChange(setYear(month, cellYear))
                      setView("date")
                    }}
                  >
                    {cellYear}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// The value is the picked day's UTC midnight (see src/lib/dates.ts); it's shown in DISPLAY_DATE_FORMAT.
// Dates can only be picked from the calendar, not typed.
function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  "aria-invalid": ariaInvalid,
}: {
  id?: string
  value?: Date
  onChange: (date: Date | undefined) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  "aria-invalid"?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? fromUtcDay(value) : undefined
  const [month, setMonthState] = React.useState(() => selected ?? new Date())
  const anchorRef = React.useRef<HTMLDivElement>(null)

  const togglePicker = () => {
    if (!open) setMonthState(selected ?? new Date())
    setOpen(!open)
  }

  const select = (date: Date) => {
    onChange(toUtcDay(date))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          aria-invalid={ariaInvalid}
          className={cn(
            "group relative flex h-[38px] w-full items-center bg-sand px-[11px] py-[5.5px] aria-invalid:bg-error-bg",
            className
          )}
        >
          <button
            id={id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full min-w-0 cursor-pointer truncate bg-transparent px-2.5 text-left text-lg leading-[27px] text-black/88 outline-none",
              !value && "text-black/25"
            )}
            onClick={togglePicker}
            onBlur={onBlur}
          >
            {value ? formatDay(value) : placeholder}
          </button>
          {value && (
            <RemoveButton
              aria-label="Clear date"
              className="absolute right-[11px] hidden group-hover:flex"
              onClick={() => onChange(undefined)}
              size="lg"
            />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        alignOffset={23}
        sideOffset={4}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Clicks on the field itself are handled by togglePicker, not treated as "outside"
          if (anchorRef.current?.contains(event.target as Node)) event.preventDefault()
        }}
        className="date-picker-container w-auto rounded-none border-0 border-t-[5px] bg-ink p-0 font-chava text-sm leading-[22px] text-white shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.05)]"
      >
        <div className="date-picker-layout border-r-[5px] border-b-[5px]">
          <div className="w-72">
            <CalendarPanel value={selected} month={month} onMonthChange={setMonthState} onSelect={select} />
            <div className="h-[38px] border-l-[5px] border-l-[#ebe3dc] text-center leading-[38px]">
              <button type="button" className="cursor-pointer" onClick={() => select(new Date())}>
                Today
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
