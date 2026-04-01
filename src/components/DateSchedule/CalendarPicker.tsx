import { useState, useMemo, useEffect } from 'react'

interface CalendarPickerProps {
  value: string // YYYY-MM-DD or ''
  onChange: (date: string) => void
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_HEADERS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function parseDate(value: string): Date | null {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

export default function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const today = new Date()
  const selected = parseDate(value)

  const [viewYear, setViewYear] = useState(() =>
    selected ? selected.getFullYear() : today.getFullYear(),
  )
  const [viewMonth, setViewMonth] = useState(() =>
    selected ? selected.getMonth() : today.getMonth(),
  )

  // Keep view in sync when value changes to a different month externally
  useEffect(() => {
    const d = parseDate(value)
    if (d) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  // Build the grid: leading nulls for offset + day numbers
  const cells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const grid: Array<number | null> = []
    for (let i = 0; i < firstDayOfWeek; i++) grid.push(null)
    for (let d = 1; d <= daysInMonth; d++) grid.push(d)
    return grid
  }, [viewYear, viewMonth])

  const handlePrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const handleNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const handleDayClick = (day: number) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`)
  }

  const isSelected = (day: number) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day

  // Year range: 2 years back to 2 years ahead
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i)

  return (
    <div className="px-3 py-3 select-none">
      {/* ── Header: ‹ Month Year › ── */}
      <div className="flex items-center mb-2">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-interaction cursor-pointer"
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex-1 flex items-center justify-center gap-1">
          {/* Month dropdown */}
          <div className="relative">
            <select
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              className="appearance-none bg-transparent text-sm font-semibold text-[var(--text-primary)] cursor-pointer pr-4 focus:outline-none"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i} className="bg-[var(--surface-2)] text-[var(--text-primary)]">
                  {m}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              width="10" height="10" viewBox="0 0 10 10" fill="none"
            >
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Year dropdown */}
          <div className="relative">
            <select
              value={viewYear}
              onChange={e => setViewYear(Number(e.target.value))}
              className="appearance-none bg-transparent text-sm font-semibold text-[var(--text-primary)] cursor-pointer pr-4 focus:outline-none"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-[var(--surface-2)] text-[var(--text-primary)]">
                  {y}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              width="10" height="10" viewBox="0 0 10 10" fill="none"
            >
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-interaction cursor-pointer"
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Day-of-week header ── */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-[var(--text-disabled)] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ── */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center py-0.5">
            {day !== null ? (
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                className={`w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center transition-interaction cursor-pointer
                  ${isSelected(day)
                    ? 'bg-[var(--accent-base)] text-white'
                    : isToday(day)
                      ? 'ring-1 ring-[var(--accent-base)] text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                  }`}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
