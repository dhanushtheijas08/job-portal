"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  AttachmentRow,
  JobDetailRow,
  JobLeadRow,
  JobRow,
  LeadAttemptRow,
} from "@/lib/jobs/constants"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

/** Same projection as dashboard list (`jobs`). */
const JOB_COLUMNS =
  [
    "id",
    "user_id",
    "job_title",
    "company_name",
    "job_url",
    "resume_url",
    "site",
    "status",
    "is_referred",
    "referred_by_name",
    "referred_by_profile_url",
    "location",
    "notes",
    "applied_at",
    "reminder_at",
    "created_at",
    "updated_at",
  ].join(",")

/** Nested select: `job_leads` → `lead_attempts` → `attachments`; plus job-root `attachments`. */
const JOB_DETAIL_SELECT = `
  ${JOB_COLUMNS},
  job_leads (
    id,
    job_id,
    name,
    role,
    linkedin_url,
    profile_url,
    email,
    status,
    created_at,
    updated_at,
    user_id,
    lead_attempts (
      id,
      lead_id,
      attempt_no,
      message_text,
      sent_at,
      reminder_at,
      response_received,
      notes,
      created_at,
      user_id,
      lead_status,
      attachments (
        id,
        job_id,
        lead_id,
        attempt_id,
        file_url,
        file_name,
        content_type,
        uploaded_at,
        user_id
      )
    )
  ),
  attachments (
    id,
    job_id,
    lead_id,
    attempt_id,
    file_url,
    file_name,
    content_type,
    uploaded_at,
    user_id
  )
`

/** Same without `attachments` under `lead_attempts` — used when the embed is unavailable. */
const JOB_DETAIL_SELECT_FALLBACK = `
  ${JOB_COLUMNS},
  job_leads (
    id,
    job_id,
    name,
    role,
    linkedin_url,
    profile_url,
    email,
    status,
    created_at,
    updated_at,
    user_id,
    lead_attempts (
      id,
      lead_id,
      attempt_no,
      message_text,
      sent_at,
      reminder_at,
      response_received,
      notes,
      created_at,
      user_id,
      lead_status
    )
  ),
  attachments (
    id,
    job_id,
    lead_id,
    attempt_id,
    file_url,
    file_name,
    content_type,
    uploaded_at,
    user_id
  )
`

const ATTACHMENT_COLUMNS = [
  "id",
  "job_id",
  "lead_id",
  "attempt_id",
  "file_url",
  "file_name",
  "content_type",
  "uploaded_at",
  "user_id",
].join(",")

function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  return null
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function normalizeAttachment(raw: Record<string, unknown>): AttachmentRow {
  return {
    id: asString(raw.id),
    job_id: asIsoOrNull(raw.job_id),
    lead_id: asIsoOrNull(raw.lead_id),
    attempt_id: asIsoOrNull(raw.attempt_id),
    file_url: asString(raw.file_url),
    file_name: asIsoOrNull(raw.file_name),
    content_type: asIsoOrNull(raw.content_type),
    uploaded_at:
      asIsoOrNull(raw.uploaded_at) ?? new Date(0).toISOString(),
    user_id: asString(raw.user_id),
  }
}

function normalizeAttempt(raw: Record<string, unknown>): LeadAttemptRow {
  const attRows = raw.attachments as unknown[] | undefined
  const attachments = Array.isArray(attRows)
    ? attRows.map((r) =>
        normalizeAttachment(r as Record<string, unknown>)
      )
    : undefined
  attachments?.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))

  return {
    id: asString(raw.id),
    lead_id: asString(raw.lead_id),
    attempt_no: typeof raw.attempt_no === "number" ? raw.attempt_no : 1,
    message_text: asIsoOrNull(raw.message_text),
    sent_at:
      asIsoOrNull(raw.sent_at) ?? new Date(0).toISOString(),
    reminder_at: asIsoOrNull(raw.reminder_at),
    response_received: Boolean(raw.response_received),
    notes: asIsoOrNull(raw.notes),
    created_at:
      asIsoOrNull(raw.created_at) ?? new Date(0).toISOString(),
    user_id: asString(raw.user_id),
    lead_status: String(raw.lead_status ?? "contacted"),
    attachments,
  }
}

function normalizeLead(raw: Record<string, unknown>): JobLeadRow {
  const sub = raw.lead_attempts as unknown[] | undefined
  const lead_attempts = Array.isArray(sub)
    ? sub
        .map((r) => normalizeAttempt(r as Record<string, unknown>))
        .sort((a, b) => a.attempt_no - b.attempt_no)
    : []
  return {
    id: asString(raw.id),
    job_id: asString(raw.job_id),
    name: asString(raw.name),
    role: asIsoOrNull(raw.role),
    linkedin_url: asIsoOrNull(raw.linkedin_url),
    profile_url: asIsoOrNull(raw.profile_url),
    email: asIsoOrNull(raw.email),
    status: String(raw.status ?? "connected"),
    created_at:
      asIsoOrNull(raw.created_at) ?? new Date(0).toISOString(),
    updated_at:
      asIsoOrNull(raw.updated_at) ?? new Date(0).toISOString(),
    user_id: asString(raw.user_id),
    lead_attempts,
  }
}

function normalizeJobDetailFromRow(raw: Record<string, unknown>): JobDetailRow {
  const jobSlice: JobRow = {
    ...(raw as unknown as JobRow),
    applied_at: asIsoOrNull(raw.applied_at),
    reminder_at: asIsoOrNull(raw.reminder_at),
  }

  const leadsRaw = raw.job_leads as unknown[] | undefined
  const job_leads = Array.isArray(leadsRaw)
    ? leadsRaw
        .map((r) => normalizeLead(r as Record<string, unknown>))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    : []

  const attRaw = raw.attachments as unknown[] | undefined
  const attachments = Array.isArray(attRaw)
    ? attRaw.map((r) =>
        normalizeAttachment(r as Record<string, unknown>)
      )
    : []

  return {
    ...jobSlice,
    job_leads,
    attachments,
  }
}

function attemptIdsFromDetail(detail: JobDetailRow): string[] {
  const ids = new Set<string>()
  for (const lead of detail.job_leads) {
    for (const att of lead.lead_attempts ?? []) {
      ids.add(att.id)
    }
  }
  return [...ids]
}

function dedupeAttachmentsById(lists: AttachmentRow[][]): AttachmentRow[] {
  const seen = new Set<string>()
  const out: AttachmentRow[] = []
  for (const list of lists) {
    for (const a of list) {
      if (seen.has(a.id)) continue
      seen.add(a.id)
      out.push(a)
    }
  }
  out.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
  return out
}

/** Merges nested embed + lookup by `attempt_id` so outreach files always show (`attachments` inserts omit `job_id`). */
async function mergeAttemptAttachments(
  detail: JobDetailRow,
  userId: string
): Promise<JobDetailRow> {
  const attemptIds = attemptIdsFromDetail(detail)
  const byAttempt = new Map<string, AttachmentRow[]>()

  if (attemptIds.length) {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("user_id", userId)
      .in("attempt_id", attemptIds)

    if (error) throw error

    for (const r of data ?? []) {
      const row = normalizeAttachment(r as unknown as Record<string, unknown>)
      if (!row.attempt_id) continue
      const list = byAttempt.get(row.attempt_id) ?? []
      list.push(row)
      byAttempt.set(row.attempt_id, list)
    }

    for (const list of byAttempt.values()) {
      list.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
    }
  }

  return {
    ...detail,
    job_leads: detail.job_leads.map((lead) => ({
      ...lead,
      lead_attempts: (lead.lead_attempts ?? []).map((att) => {
        const fromQuery = byAttempt.get(att.id) ?? []
        const fromEmbed = att.attachments ?? []
        return {
          ...att,
          attachments: dedupeAttachmentsById([fromQuery, fromEmbed]),
        }
      }),
    })),
  }
}

/** Full job plus `job_leads`, `lead_attempts`, `attachments` (see schema). */
export function useJobDetailQuery(
  userId: string | undefined,
  jobId: string | undefined,
  open: boolean
) {
  return useQuery({
    queryKey: ["job-detail", userId, jobId],
    enabled: Boolean(userId && jobId && open),
    queryFn: async (): Promise<JobDetailRow> => {
      if (!userId || !jobId) {
        throw new Error("Missing user or job.")
      }
      const supabase = getSupabaseBrowserClient()

      const preferred = await supabase
        .from("jobs")
        .select(JOB_DETAIL_SELECT)
        .eq("id", jobId)
        .eq("user_id", userId)
        .single()

      if (!preferred.error && preferred.data) {
        const normalized = normalizeJobDetailFromRow(
          preferred.data as unknown as Record<string, unknown>
        )
        return mergeAttemptAttachments(normalized, userId)
      }

      const fallback = await supabase
        .from("jobs")
        .select(JOB_DETAIL_SELECT_FALLBACK)
        .eq("id", jobId)
        .eq("user_id", userId)
        .single()

      if (fallback.error) throw fallback.error

      const base = normalizeJobDetailFromRow(
        fallback.data as unknown as Record<string, unknown>
      )
      return mergeAttemptAttachments(base, userId)
    },
  })
}
