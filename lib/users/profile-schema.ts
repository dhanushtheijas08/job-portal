import { z } from "zod"

export const MAX_PROFILE_RESUMES = 20

const RESUME_ENTRY_ID_LENGTH = 4
const RESUME_ENTRY_ID_RE = new RegExp(
  `^[A-Za-z0-9]{${RESUME_ENTRY_ID_LENGTH}}$`
)

/** Public resume row id persisted with each entry (exactly four alphanumeric chars). */
export function isValidResumeEntryId(value: unknown): value is string {
  return typeof value === "string" && RESUME_ENTRY_ID_RE.test(value)
}

/** Random alphanumeric id for a resume row. */
export function generateResumeEntryId(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = new Uint8Array(RESUME_ENTRY_ID_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % 62]).join("")
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export const resumeEntrySchema = z.object({
  id: z.string().regex(RESUME_ENTRY_ID_RE),
  name: z.string().max(200),
  url: z.string().max(4000),
  last_used_at: z.string().nullable(),
})

export type ResumeEntry = z.infer<typeof resumeEntrySchema>

export function sortResumesByLastUsedDesc(
  resumes: ResumeEntry[]
): ResumeEntry[] {
  const rank = (iso: string | null) => {
    if (!iso?.trim()) return Number.NEGATIVE_INFINITY
    const t = new Date(iso).getTime()
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
  }
  return [...resumes].sort((a, b) => {
    const diff = rank(b.last_used_at) - rank(a.last_used_at)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

export const userSettingsFormSchema = z
  .object({
    linkedin_url: z.string().max(2000),
    github_url: z.string().max(2000),
    portfolio_url: z.string().max(2000),
    resumes: z.array(resumeEntrySchema).max(MAX_PROFILE_RESUMES),
  })
  .superRefine((data, ctx) => {
    const optionalLink = (
      key: "linkedin_url" | "github_url" | "portfolio_url",
      label: string
    ) => {
      const v = data[key]?.trim()
      if (v && !isHttpUrl(v)) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be a valid http(s) URL.`,
          path: [key],
        })
      }
    }
    optionalLink("linkedin_url", "LinkedIn")
    optionalLink("github_url", "GitHub")
    optionalLink("portfolio_url", "Portfolio")

    const seen = new Set<string>()
    for (let i = 0; i < data.resumes.length; i++) {
      const rid = data.resumes[i]!.id
      if (seen.has(rid)) {
        ctx.addIssue({
          code: "custom",
          message: "Each resume needs a distinct id.",
          path: ["resumes", i, "id"],
        })
      }
      seen.add(rid)
    }
  })

export type UserSettingsFormValues = z.infer<typeof userSettingsFormSchema>

export function emptyResumeFormEntry(): ResumeEntry {
  return {
    id: generateResumeEntryId(),
    name: "",
    url: "",
    last_used_at: null,
  }
}

export function emptyToNull(s: string): string | null {
  const t = s.trim()
  return t ? t : null
}

export function normalizeResumeEntriesFromDb(raw: unknown): ResumeEntry[] {
  if (!raw || !Array.isArray(raw)) return []
  const usedIds = new Set<string>()
  const out: ResumeEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const name = typeof rec.name === "string" ? rec.name : ""
    const url = typeof rec.url === "string" ? rec.url : ""
    let last_used_at: string | null = null
    if (typeof rec.last_used_at === "string" && rec.last_used_at.trim()) {
      last_used_at = rec.last_used_at
    } else if (
      typeof rec.last_user_at === "string" &&
      rec.last_user_at.trim()
    ) {
      last_used_at = rec.last_user_at
    }
    if (!name && !url) continue
    let id = isValidResumeEntryId(rec.id) ? rec.id : generateResumeEntryId()
    while (usedIds.has(id)) id = generateResumeEntryId()
    usedIds.add(id)
    out.push({ id, name, url, last_used_at })
  }
  return out
}
