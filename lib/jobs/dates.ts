/** Local calendar date as YYYY-MM-DD (for `<input type="date">` and forms). */
export function formatYmdFromDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function todayYmd(): string {
  return formatYmdFromDate(new Date())
}

export function parseYmdToLocalDate(value: string): Date | undefined {
  const t = value?.trim()
  if (!t) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return undefined
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return undefined
  }
  return dt
}

/** `applied_at` / `reminder_at` from Supabase — ISO timestamps or plain DATE as YYYY-MM-DD. */
export function formatStoredJobDate(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parsed = parseYmdToLocalDate(s)
    if (!parsed) return null
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      parsed
    )
  }

  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(t)
  )
}

/** Full timestamps such as `created_at` / `updated_at` from Postgres. */
export function formatStoredTimestamp(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(t))
}
